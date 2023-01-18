# IPL Media Creator 🎥
A Discord bot application that can create downloadable highlights from our livestreams. It can also create other graphics quickly.

#### Required To Run:
- [Node.js](https://nodejs.org/en/)
- [Ffmpeg](http://www.ffmpeg.org/)

#### NPM packages used:
- [Discord.js](https://www.npmjs.com/package/discord.js)
- [Fluent ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg)
- [Puppeteer](https://www.npmjs.com/package/puppeteer)
- [AWS SDK](https://www.npmjs.com/package/aws-sdk)

## Using the bot:

In the project directory, you will need to create a file called `config.json`. In this file, you need to provide a bot token, server ID, and bot client ID. It should look something like this. 
```json
{
    "token": "token goes here",
    "guildId": "server id goes here",
    "clientId": "bot client id goes here",

    "encoder": "encoder goes here (use h264 or anything that suits your device!)",

    "s3_keyId":"",
    "s3_secretAccessKey":"",
    "s3_endpoint":"",
    "s3_bucket":"",
    "s3_path":""
}
```
You will also need to provide your own intro videos to the project. In the project directory, create a folder called `overlays`. Intro videos should be put in this folder, they also must be in `.webm` format. You will need to modify `highlight.js` to actually be able to use your overlay.

You must run `deploy-commands.js` before launching the bot if you change the server id in `config.json`.

To launch the bot, run `index.js`.

### Other notices

This bot is limited to being active in one server only, and I only expect one user using it at a time. While some testing shows it can handle processing multiple clips at once, do not be suprised if it fails in these cases.
