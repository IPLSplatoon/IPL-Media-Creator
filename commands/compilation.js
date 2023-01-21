const { SlashCommandBuilder } = require('@discordjs/builders');
const puppeteer = require('puppeteer');
const { encoder, s3_keyId, s3_bucket, s3_endpoint, s3_path, s3_secretAccessKey, s3_url } = require("../config.json");

const fileNameOut = "_comp.mp4";

//create s3 server data
var AWS = require('aws-sdk');

AWS.config.credentials = {
    accessKeyId: s3_keyId,
    secretAccessKey: s3_secretAccessKey,
};
var ep = new AWS.Endpoint(s3_endpoint);
var s3 = new AWS.S3({endpoint: ep});

const data = new SlashCommandBuilder()
    .setName("compilation")
    .setDescription("Combines multiple twitch clips into one video.")
    .addStringOption(option =>
        option.setName('clips')
            .setDescription('Add urls to twitch clips, seperated by spaces')
            .setRequired(true)
    )
    .toJSON();

    const ffmpeg = require('fluent-ffmpeg');

async function getDuration(file){
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(file, function(error, metadata) {
            if (error){
                reject(error);
            }

            resolve(metadata.format.duration);
        });
    });
}

async function ffmpegConcat(inputs) {
    return new Promise(async (resolve, reject) => {

        let durations = new Array();

        for (let i = 0; i < inputs.length; ){
            await getDuration(inputs[i])
                .then(function(duration){
                    console.log(duration);
                    durations.push(duration);
                    i++;
                })
                .catch(function(error){
                    console.log(error);
                    reject(error);
                });
        }

        let durationSum = 0;
        let complexfilters = new Array();

        //add resizes
        for (let i = 0; i < durations.length; i++){
            complexfilters.push({
                "filter":"scale", "options":{s:"1280x720"}, "inputs":`[${i}]`, "outputs":`[scaler${i}]`
             });
            complexfilters.push({
                "filter":"settb", "options":{tb:"AVTB"}, "inputs":`[scaler${i}]`, "outputs":`[s${i}]`
            });
        }

        //add fades
        if (durations.length == 2){
            complexfilters.push({
                "filter":"xfade", "options":{transition:"fadeblack",duration:"1",offset:`${(durations[0]-1)}`}, "inputs":"[s0][s1]"
            });
            complexfilters.push({
                "filter":"acrossfade","options":{d:"1"},"inputs":"[0:a][1:a]"
            });
        } else {
            for (let i = 0; i < durations.length-1; i++){
                durationSum += durations[i]-1;
                if (i == 0){ //first element
                    complexfilters.push({
                        "filter":"xfade", "options": {transition:"fadeblack", duration:"1", offset:`${durationSum}`}, "inputs":`[s${i}][s${i+1}]`, "outputs":`[vo${i+1}]`
                    });
                    complexfilters.push({
                        "filter":"acrossfade", "options":{d:"1"}, "inputs":`[${i}:a][${i+1}:a]`, "outputs":`[ao${i+1}]`
                    });
                }
                else if (i == durations.length-2){ //last element
                    complexfilters.push({
                        "filter":"xfade", "options": {transition:"fadeblack", duration:"1", offset:`${durationSum}`}, "inputs":`[vo${i}][s${i+1}]`
                    });
                    complexfilters.push({
                        "filter":"acrossfade", "options":{d:"1"}, "inputs":`[ao${i}][${i+1}:a]`
                    });
                }
                else {
                    complexfilters.push({
                        "filter":"xfade", "options": {transition:"fadeblack", duration:"1", offset:`${durationSum}`}, "inputs":`[vo${i}][s${i+1}]`, "outputs":`[vo${i+1}]`
                    });
                    complexfilters.push({
                        "filter":"acrossfade", "options":{d:"1"}, "inputs":`[ao${i}][${i+1}:a]`, "outputs":`[ao${i+1}]`
                    });
                }
            }
        }

        resolve(complexfilters);

    });
}

function startConcat(links){
    return new Promise((resolve, reject) => {

        let fileName = Date.now() + fileNameOut;

        ffmpegConcat(links)
            .then(function(complexfilters){
                console.log(complexfilters);
                const ffmpegObj = ffmpeg();
                for (let i = 0; i < links.length; i++){
                    ffmpegObj.addInput(links[i]);
                }
                ffmpegObj
                    .complexFilter(complexfilters)
                    .withOptions([
                        "-c:v " + encoder,
                        "-pix_fmt yuv420p",
                        "-c:a aac",
                        "-crf 23"
                    ])
                    .save(fileName)
                    .on('start', function(){
                        console.log("starting ffmpeg for compilation");
                    })
                    .on('error', function(error){
                        deleteFile(fileName);
                        reject(error);
                    })
                    .on('end', function(){
                        resolve(fileName);
                    });
            });
    });
}


module.exports = {
    data,
    async execute(interaction) {

        const clipInput = interaction.options.getString('clips')
        const clips = clipInput.split(' ');
        
        //make sure these are twitch links
        for(let i = 0; i < clips.length; i++){
            if (!clips[i].match(/https:\/\/www\.twitch\.tv\/iplsplatoon\/clip\/[A-Za-z0-9]{1,}/) //https://www.twitch.tv/iplsplatoon/clip/
            && !clips[i].match(/https:\/\/clips\.twitch\.tv/)){ //https://clips.twitch.tv/
            await interaction.reply({
                content:`**URL #${i+1} is invalid!**\nPlease enter an IPL twitch clip link!`,
                ephemeral: true
                });
                return;
            }
        }
        
        //tell both discord and the end user this might take a while
        await interaction.deferReply();

        try{
            //launch a headless browser and load the twitch page
            var sources = [];
            try{
                console.log("launching headless browser.");
                const browser = await puppeteer.launch();

                for (let i = 0; i < clips.length; i++){
                    const page = await browser.newPage();
                    await page.goto(clips[i], { waitUntil: 'networkidle0' });
                    console.log("page loaded, finding and getting video source.");

                    //get the source link of the video
                    const sourcelink = await page.evaluate(() => {
                        return document.querySelector("video").currentSrc;
                    });

                    //we gotta change the link a bit before we can process it
                    var vidIdSplit = sourcelink.split('?')[0].split('/');
                    var vidId = vidIdSplit.at(-1);
                    var vidId2 = vidIdSplit.at(-2);
                    sources.push(`https://clips-media-assets2.twitch.tv/${vidId2}/${vidId}`);
                }
                
                await browser.close();
            } catch (err) {
                await interaction.editReply("There was an error getting a clip from twitch!\n`" + err + "`");
                return;
            }

            
            //ffmpeg time
            await startConcat(sources)
                .then(function(fileName){
                    console.log("Uploading...");

                    //upload to server
                    var uploadParams = {Bucket: s3_bucket, Key: '', Body: ''};
                    const fs = require('fs');
                    var fileStream = fs.createReadStream(fileName);
                    fileStream.on('error', function(err) {
                        console.log('File Error', err);
                    });
                    uploadParams.Body = fileStream;
                    var path = require('path');
                    uploadParams.Key = s3_path + path.basename(fileName);

                    s3.upload(uploadParams, function(err,data){
                        if (err){
                            console.log("Upload Error",err);
                            interaction.editReply("There was an error uploading to the server!");
                            deleteFile(fileName);
                        }
                        if (data){
                            console.log("Uploaded file", data.Location);
                            var fileLoc = data.Location;
                            if (!fileLoc.includes("https")){
                                fileLoc = s3_url + fileLoc;
                            }
                            interaction.editReply(fileLoc);
                            deleteFile(fileName);
                        }
                    });
                    
                }).catch(function(err) {
                    console.log("ffmpegOverlayer was rejected: " + err);
                    interaction.editReply("There was an error processing this clip!\n`" + err + "`");
                });
        }
        catch (err) {
            await interaction.editReply("There was a error carrying out this command!\n`" + err + "`");
        }   
    },
};

function deleteFile(fileName){
    const fs = require('fs');
    fs.unlink(fileName, (err) => { 
        if (err) { 
            console.log(err); 
        }
    });
}