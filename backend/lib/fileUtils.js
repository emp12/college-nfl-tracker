/**
 * lib/fileUtils.js
 *
 * Small helper functions for reading and writing JSON files.
 * The goal is to centralize file I/O and error handling.
 */

const fs = require("fs");
const path = require("path");

/**
 * readJson
 * --------
 * Reads a JSON file from disk and parses it into a JavaScript object.
 *
 * @param {string} filePath - Absolute path to the JSON file on disk.
 * @returns {Promise<any>}  - Resolves with the parsed JS object.
 *
 * If the file does not exist or cannot be parsed, this function will throw.
 * Calling code should catch and handle that.
 */
function readJson(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        // Common causes: file not found, permission issues
        return reject(
          new Error(`Failed to read JSON file at ${filePath}: ${err.message}`)
        );
      }

      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (parseErr) {
        reject(
          new Error(
            `Failed to parse JSON file at ${filePath}: ${parseErr.message}`
          )
        );
      }
    });
  });
}

/**
 * writeJsonAtomic
 * ---------------
 * Writes a JS object to a JSON file on disk using an "atomic" strategy.
 *
 * Instead of writing directly to the target file, we:
 *  1. Write to a temporary file (same folder, .tmp extension)
 *  2. Rename the temporary file to the final file name
 *
 * This prevents partial writes if the process crashes mid-write,
 * which could leave a corrupted file behind.
 *
 * @param {string} filePath - Absolute path to the target JSON file.
 * @param {any} data        - JavaScript object to serialize and write.
 * @returns {Promise<void>}
 */
function writeJsonAtomic(filePath, data) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    const tempFilePath = path.join(
      dir,
      `${path.basename(filePath)}.tmp-${Date.now()}`
    );

    const jsonString = JSON.stringify(data, null, 2); // 2-space indent for readability

    // Step 1: write to temp file
    fs.writeFile(tempFilePath, jsonString, "utf8", (writeErr) => {
      if (writeErr) {
        return reject(
          new Error(
            `Failed to write temp JSON file at ${tempFilePath}: ${writeErr.message}`
          )
        );
      }

      // Step 2: rename temp file to final file
      fs.rename(tempFilePath, filePath, (renameErr) => {
        if (renameErr) {
          return reject(
            new Error(
              `Failed to rename temp JSON file from ${tempFilePath} to ${filePath}: ${renameErr.message}`
            )
          );
        }

        resolve();
      });
    });
  });
}

module.exports = {
  readJson,
  writeJsonAtomic,
};