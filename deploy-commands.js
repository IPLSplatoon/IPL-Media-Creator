const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } =  require('./config.json');

const commands = []
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
    const data = command.data;
    if (Array.isArray(data)){
        for (let i = 0; i < data.length; i++){
            commands.push(data[i]);
        }
    } else {
	    commands.push(data);
    }
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log("Refreshing...", commands);

        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log("Successfully refreshed slash commands");
    } catch (error) {
        console.error(error);
    }
})();