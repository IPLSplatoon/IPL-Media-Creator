const { SlashCommandBuilder, SlashCommandStringOption } = require('@discordjs/builders');
var ffmpeg = require("fluent-ffmpeg");
const { encoder, s3_keyId, s3_bucket, s3_endpoint, s3_path, s3_secretAccessKey, radiaGuildId, radiaAuth } = require("../config.json");
const fetch = require('node-fetch');

const fileNameOut = "_hl.mp4";


//create s3 server data
var AWS = require('aws-sdk');

AWS.config.credentials = {
    accessKeyId: s3_keyId,
    secretAccessKey: s3_secretAccessKey,
};
var ep = new AWS.Endpoint(s3_endpoint);
var s3 = new AWS.S3({ endpoint: ep });



const data = getThisCommand();

function getThisCommand() {
    let options = new SlashCommandStringOption()
        .setName("tournament")
        .setRequired(true)
        .setDescription('Specify which tournament this clip is from.');

    const highlightOverlaysConfig = require("../highlight-overlays/highlight-overlays-config.json");
    for (let i = 0; i < highlightOverlaysConfig.length; i++) {
        options.addChoice(highlightOverlaysConfig[i].name, highlightOverlaysConfig[i].overlay);
    }

    let builder = new SlashCommandBuilder()
        .setName("highlight")
        .setDescription("Creates a downloadable stream highlight from a twitch clip.")
        .addStringOption(options)
        .addStringOption(option =>
            option.setName('link')
                .setDescription("Attach an IPL Twitch clip link.")
                .setRequired(true)
        );

    return builder.toJSON();
}


function ffmpegOverlayer(file, tourney) {
    return new Promise((resolve, reject) => {

        var fileName = tourney + Date.now() + fileNameOut;

        ffmpeg().withOptions([
            "-i ./highlight-overlays/" + tourney + ".png", //take the overlay as an input
            "-i " + file, //take the twitch clip as an input
        ])
            .complexFilter([
                {
                    "filter": "scale", "options": { s: "1280x720" }, "inputs": "[1:v]", "outputs": "[base]" //resize the twitch clip to 720p
                },
                {
                    "filter": "overlay", "inputs": "[0:v][base]" //overlay the overlay onto the twitch clip
                }
            ])
            .withOptions([
                "-r 60",
                "-crf 31",
                "-c:v " + encoder //encode the video
            ])
            .on('start', function () {
                console.log("starting ffmpeg with input " + file + " and overlay " + tourney);
            })
            .on('error', function (err) {
                console.log('An ffmpeg error occurred: ' + err.message);
                deleteFile(fileName)
                return reject(new Error(err), fileName);
            })
            .on('end', function () {
                console.log("ffmpeg is done!");
                resolve(fileName);
            })
            .save(fileName);
    });
}



//this runs when the highlight command is executed.
module.exports = {
    data,
    async execute(interaction) {

        const tourney = interaction.options.getString('tournament');
        const link = interaction.options.getString('link');

        // make sure this is a twitch link
        if (!link.match(/https:\/\/www\.twitch\.tv\/iplsplatoon\/clip\/[A-Za-z0-9]{1,}/) //https://www.twitch.tv/iplsplatoon/clip/
            && !link.match(/https:\/\/clips\.twitch\.tv/)){ //https://clips.twitch.tv/
            await interaction.reply({
                content:"**Invalid link.**\nPlease enter an IPL twitch clip link!",
                ephemeral: true
            });
            return;
        }

        //tell both discord and the end user this might take a while
        await interaction.deferReply();

        //get the id of the clip
        const clipID = link.split("/").pop();

        try {
            await getClipDownloadURL(clipID)
                .then (async function(downloadLink){

                    //ffmpeg time
                    await ffmpegOverlayer(downloadLink, tourney)
                    .then(function (fileName) {
                        console.log("Uploading...");

                        //upload to server
                        var uploadParams = { Bucket: s3_bucket, Key: '', Body: '' };
                        const fs = require('fs');
                        var fileStream = fs.createReadStream(fileName);
                        fileStream.on('error', function (err) {
                            console.log('File Error', err);
                        });
                        uploadParams.Body = fileStream;
                        var path = require('path');
                        uploadParams.Key = s3_path + path.basename(fileName);

                        s3.upload(uploadParams, function (err, data) {
                            if (err) {
                                console.log("Upload Error", err);
                                interaction.editReply("There was an error uploading to the server!");
                                deleteFile(fileName);
                            }
                            if (data) {
                                console.log("Uploaded file", data.Location);
                                interaction.editReply("https://files.iplabs.work/file/iplabs-public/StreamHighlights/" + fileName);
                                deleteFile(fileName);
                            }
                        });

                    }).catch(function (err) {
                        console.log("ffmpegOverlayer was rejected: " + err);
                        interaction.editReply("There was an error processing this clip!\n`" + err + "`");
                    });

                })
        }
        catch (err) {
            await interaction.editReply("There was a error carrying out this command!\n`" + err + "`");
        }
    },
};

function deleteFile(fileName) {
    const fs = require('fs');
    fs.unlink(fileName, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

async function getClipDownloadURL(clipID) {
    console.log(`Getting download URL from ${clipID}`)
    return fetch(`https://radia.iplabs.work/clips/${radiaGuildId}/${clipID}`, {
        method: 'POST',
        headers: {
            Authorization: radiaAuth
        }
    })
    .then(res => {
        console.log("res", res);
        if (res.ok) {
            return res.json();
        } else {
            throw new Error('Clip ID not found');
        }
    })
    .then(json => {
        console.log("json", json);
        const downloadID = json[0].thumbnail_url.match(/(?<=twitch.tv\/)(.*)(?=-preview)/)[0]
        console.log("downloadID", downloadID);
        if (downloadID !== null) {
            return `https://clips-media-assets2.twitch.tv/${downloadID}.mp4`;
        }
        throw new Error('Clip download URL not found');
    });
}