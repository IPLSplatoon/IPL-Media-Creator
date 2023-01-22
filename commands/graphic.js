const { SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const puppeteer = require('puppeteer');

const data = getThisCommand();

function getThisCommand() {
    const builders = [];
    const config = require("../graphic-templates/graphic-templates-config.json");
    for (let i = 0; i < config.length; i++){
        const builder = new SlashCommandBuilder()
            .setName("graphic-" + config[i].name)
            .setDescription(config[i].description);

        for(let j = 0; j < config[i].options.length; j++){
            const subcommand = new SlashCommandSubcommandBuilder()
                .setName(config[i].options[j].name)
                .setDescription(config[i].options[j].description);

            for (let k = 0; k < config[i].options[j].options.length; k++){
                const option = new SlashCommandStringOption()
                    .setName(config[i].options[j].options[k].name)
                    .setDescription(config[i].options[j].options[k].description)
                    .setRequired(true);
                subcommand.addStringOption(option);
            }

            builder.addSubcommand(subcommand);
        }

        builders.push(builder.toJSON());
    }

    return builders;
}

module.exports = {
    data,
    async execute(interaction) {
        const config = require("../graphic-templates/graphic-templates-config.json");
        const commandName = interaction.commandName.split("-").pop();

        const commandConfig = config.find(o => o.name === commandName);
        const subCommandConfig = commandConfig.options.find(o => o.name === interaction.options.getSubcommand());
        
        const commandOptions = [];
        for (let i = 0; i < subCommandConfig.options.length; i++){
            const commandOptionName = subCommandConfig.options[i].name;
            const commandOptionVal = interaction.options.getString(commandOptionName);
            commandOptions.push({name: commandOptionName, value: commandOptionVal});
        }

        let uri = "";
        for (let i = 0; i < commandOptions.length; i++){
            uri = uri.concat(i == 0 ? "?" : "&");
            uri = uri.concat(`${commandOptions[i].name}=${encodeURIComponent(commandOptions[i].value)}`);
        }

        const puppeteer = require("puppeteer");
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        const path = `file://${process.cwd()}/graphic-templates/${commandConfig.name}-${subCommandConfig.name}.html${uri}`
        await page.setViewport({ width: subCommandConfig.width, height: subCommandConfig.height });
        await page.goto(path);
        const screenshot = await page.screenshot({type: "jpeg", quality: 100});
        
        const attachment = new MessageAttachment(screenshot);
        await interaction.reply({files: [attachment]})
    }
}