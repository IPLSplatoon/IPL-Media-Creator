const { SlashCommandBuilder, SlashCommandStringOption } = require('@discordjs/builders');
const puppeteer = require('puppeteer');

const data = getThisCommand();

function getThisCommand() {
    let options = new SlashCommandStringOption();

    const graphicConfig = require("../graphic-templates/graphic-templates-config.json");
}