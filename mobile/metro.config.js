// Lets the phone app import the same booking rules as the web app
// (../src/lib: slot check, pricing, refunds, house rules), so the two never disagree.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../src/lib")];

module.exports = config;
