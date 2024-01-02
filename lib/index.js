import fs from "fs";
import path from "path";
import desm from "desm";
import last from "lodash.last";

const __dirname = desm(import.meta.url);

function isBlank(str) {
  return /^[\s]*$/.test(str);
}

const distFolder = `${__dirname}/../dist`;
if(!fs.existsSync(distFolder)) {
  fs.mkdirSync(distFolder);
}

// --------------------------------------------------------
// Start with the base program that the user interacts with

const helpProgram = fs.readFileSync(`${__dirname}/baseProgram.comfy`, 'utf8');
const helpProgramLines = helpProgram
  .split("\n")
  .filter((line) => line.trim().length > 0);

// --------------------------------------------------------
// Prepend a thing to GOSUB to all the topic definitions

const outputContentLines = [
  "hilite = '\\uE9D0'",
  "tNames = ARRAY",
  "tContents = ARRAY",
  `GOSUB ${helpProgramLines.length + 5}`
].concat(helpProgramLines);

// --------------------------------------------------------
// Read all the topic files and transform them into DATA statements

const helpTopicsFolder = `${__dirname}/onlineHelp`;
fs.readdirSync(helpTopicsFolder).forEach((file) => {
  const helpTopicName = path.basename(file, path.extname(file)).toLowerCase();
  const helpTopicPath = `${helpTopicsFolder}/${file}`;
  const helpTopic = fs.readFileSync(helpTopicPath, 'utf8');

  outputContentLines.push(`INSERT tNames, '${helpTopicName}'`);
  outputContentLines.push("t = BEGIN ARRAY");
  const formattedLines = helpTopic
    .split("\n")
    .map((line) => line.replaceAll(
    /(\\([0-9]{3}))/g,
    function(all, group1, group2) {
      return String.fromCharCode(parseInt(group2, 10));
    }))
    .map((line) => line.replaceAll(
      /(\\u([0-9a-fA-F]{4}))/g,
      function(all, group1, group2) {
        return String.fromCharCode(parseInt(group2, 16));
      }))
    .map((line) => line.replaceAll(/[\\]/g, '\\\\'))
    .map((line) => line.replaceAll(/[']/g, '\\\''))
    .map((line) => line.replaceAll(/%%/g, '!!!!!!'))
    .map((line) => line.replaceAll(/%([^%]+)%/g, '\' + hilite + \'$1\uE8FE'))
    .map((line) => line.replaceAll(/!!!!!!/g, '%'))
    .map((line) => line.trimEnd());

  // trim trailing blank lines
  while (formattedLines.length && isBlank(last(formattedLines))) {
    formattedLines.pop();
  }

  formattedLines
    .map((line) => `  DATA '${line}'`)
    .forEach((line) => {
      outputContentLines.push(line);
    })
  outputContentLines.push("END");
  outputContentLines.push("INSERT tContents, t");
});

// --------------------------------------------------------
// All the topics were a big subroutine, RETURN back to the baseProgram

outputContentLines.push("RETURN");

const outputFileContents = outputContentLines
  .map((line, i) => `${i+1} ${line}`)
  .join('\n');
fs.writeFileSync(`${distFolder}/helpKeyword.comfy`, outputFileContents, "utf8");
