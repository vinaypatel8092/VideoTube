import fs from "fs";

function escapeRegExp(string = '') {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeFileFromLocalMachine(localFilePath) {
  if(localFilePath) {
    fs.unlinkSync(localFilePath);
  }
}

export { escapeRegExp, removeFileFromLocalMachine };