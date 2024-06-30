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

const walkFolder = function(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    const filePath = dir + '/' + file;
    var stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walkFolder(filePath));
    } else {
      /* Is a file */
      results.push(filePath);
    }
  });
  return results;
}

const helpTopicsFolder = `${__dirname}/onlineHelp`;
const foundTopics = [];

walkFolder(helpTopicsFolder).forEach((filePath) => {
  const helpTopicName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  if (foundTopics.indexOf(helpTopicName) < 0) {
    foundTopics.push(helpTopicName);
  }
});

walkFolder(helpTopicsFolder).forEach((filePath) => {
  const helpTopicName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const helpTopic = fs.readFileSync(filePath, 'utf8');

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
    .map((line) => line.replaceAll(/%([^%]+)%/g, (matchedStr, sel_word) => {
      const highlightedNonKeyword = sel_word.charCodeAt(0) > 255;
      const isKeyword = foundTopics.indexOf(sel_word.toLowerCase()) >= 0;

      return (highlightedNonKeyword || isKeyword) ? `\' + hilite + \'${sel_word}\uE8FE` : sel_word;
    }))
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
