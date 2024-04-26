import puppeteer from "puppeteer"
import argsParser from "args-parser"

import { mkdirSync, createWriteStream } from "node:fs"
import { Readable } from "node:stream"
import { finished } from "node:stream/promises"
import { ReadableStream } from 'stream/web'
import sanitize from "sanitize-filename"

(async() => {
  const commandLineArguments = argsParser(process.argv);

  const requestedPublisher = commandLineArguments.publisher as string;
  const requestedAlbums = commandLineArguments.albums.split(",") as Array<string>;

  console.log("Requested publisher:", requestedPublisher);
  console.log("Requested albums:", requestedAlbums.join(", "));

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: [
      '--disable-infobars',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
      '--no-sandbox',
    ]
  });

  const [page] = await browser.pages();
  await page.close();

  const assembledAlbumUrls = requestedAlbums.map(requestedAlbum => {
    return `https://${requestedPublisher}.bandcamp.com/album/${requestedAlbum}`
  });

  const albums = new Array<{ title: string, tracks: Array<{ title: string, file: string }> }>();

  for (const assembledAlbumUrl of assembledAlbumUrls) {
    console.log(assembledAlbumUrl)

    const page = await browser.newPage();
    await page.goto(assembledAlbumUrl);

    const playlist = await page.evaluate(() => {
      // @ts-ignore
      return Player.tralbum_data.trackinfo;
    });


    albums.push({
      title: (await page.title()).split('|')[0].trim(),
      tracks: playlist.map((track: any) => {
        return {
          title: track.title,
          file: track.file['mp3-128'],
        }
      })
    });

    console.log(JSON.stringify(albums));
  }

  for (const album of albums) {
    mkdirSync(sanitize(album.title));
    for (const track of album.tracks) {
      const stream = createWriteStream(`${sanitize(album.title)}/${sanitize(track.title)}.mp3`);
      const { body } = await fetch(track.file);
      if (!body) {
        console.log(track.title + ' fail')
        return;
      }
      await finished(Readable.fromWeb(body as ReadableStream<any>).pipe(stream));
      stream.close();
      console.log(album.title, "—", track.title);
    }
 }

 await browser.close();
})()
