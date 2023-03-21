const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName("battlefy-team-pic")
    .setDescription("Get battlefy team pictures from tournament link.")
    .addStringOption(option =>
        option.setName('url')
            .setDescription('URL to battlefy tournament')
            .setRequired(true)
    )
    .toJSON();

module.exports = {
    data,
    async execute(interaction) {
        const info = "Visit this page to see the team pictures, right click and copy image address to use in a command.\n"
        const urlTemp = "https://drb-dotjpg.github.io/battlefy-team-pic-grabber/tourney.html?id=";
        const id = getID(interaction.options.getString("url"));
        if (id === undefined){
            return interaction.reply({content: "Please enter a Battlefy URL!", ephemeral: true});
        }
        await interaction.reply({content: info + urlTemp + id, ephemeral: true});
    }
}

function getID(search) {
    if (search.includes("https://battlefy.com/")){
        const split = search.split("/")
        if(split[5]!=undefined){
            return split[5];
        }
    }else{
        return undefined;
    }
}