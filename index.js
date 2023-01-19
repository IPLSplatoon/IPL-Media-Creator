//require necessary js classes
const fs = require('fs');
const { Client, Intents, Collection } = require('discord.js');
const { token } = require("./config.json");

console.log("Logging into bot...\nDon't forget to run deploy-commands.js if you made changes to any config files!");

//create a new client instance
const client = new Client({
    intents: [Intents.FLAGS.GUILDS]
});

//get all the command files and load them
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

//run this when this client is ready
client.once('ready', () => {
    console.log("Logged in: Awaiting commands.");
});

//runs whenever there is an interaction (eg. a command is run)
client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'I had trouble executing that command!', ephemeral: true });
	}
});

client.login(token);