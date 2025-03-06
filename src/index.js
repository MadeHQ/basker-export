'use strict';

const { cpSync, createWriteStream, rmdirSync, readFileSync, writeFileSync } = require('fs');
const archiver = require('archiver');

const pluginName = '@madehq/pl-basker-export';
const safePluginName = '@madehq-pl-basker-export';

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

module.exports = function (patternlab) {
  if (!patternlab) {
    process.exit(1);
  }

  if (pluginName in patternlab.config.plugins === false) {
    return;
  }

  if (patternlab.config.plugins[pluginName].enabled !== true) {
    return;
  }

  if (patternlab.config.plugins[pluginName].initialized === true) {
    return;
  }

  const delay = parseInt(patternlab.config.plugins[pluginName].debounce, 10) || 1500;

  let writingDownloadLink = false;

  patternlab.events.on('patternlab-pattern-write-end', debounce(() => {
    if (writingDownloadLink) {
      return;
    }

    addDownloadLink();

    writingDownloadLink = true;

    generateExportZip();

    writingDownloadLink = false;
  }, delay));

  patternlab.config.plugins[pluginName].initialized = true;
}

async function addDownloadLink() {
  const plViewerFile = 'public/styleguide/js/patternlab-viewer.modern.js';

  let plViewerContent = readFileSync(plViewerFile, 'utf8');

  if (plViewerContent.indexOf('Basker Export') === -1) {
    plViewerContent = plViewerContent.replace(/<li class="pl-c-tools__item">/, '<li class="pl-c-tools__item"><a class="pl-c-button pl-c-button--medium" href="/basker-export.zip"><span class="pl-c-button__text">Basker Export</span><span class="pl-c-button__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="width: 1.2em; height: 1.2em"><path fill="none" d="M0 0h48v48H0z"/><path d="M22 4v16h-8l10 10 10-10h-8V4zM8 44h32c2.206 0 4-1.794 4-4V30h-4v10H8V30H4v10c0 2.206 1.794 4 4 4z"/></svg></span></a></li><li class="pl-c-tools__item">');

    writeFileSync(plViewerFile, plViewerContent, 'utf8');
  }
}

function generateExportZip() {
  /**
   * Create `export` directory with following structure
   * (see https://basker.dev/themes/architecture/overview#directory-structure-and-component-types)
   * export/
   *  - assets/
   *  - config/
   *  - layouts/
   *  - locales/
   *  - comonents/
   *  - snippets/
   *  - templates/
   */

  // Remove any existing export files
  try {
      rmdirSync('export', { recursive: true, force: true });
  } catch (e) {}

  // Creates `export` directory and copies files from `theme` into it
  cpSync('theme', 'export', { recursive: true });

  // Copies
  cpSync('source/_data/settings_schema.json', 'export/config/settings_schema.json', { recursive: true });

  // Copy Assets (possibly need to delete top level directories)
  cpSync('public/assets', 'export/assets', { recursive: true });

  // Generate the ZIP Export from the `export` directory
  const output = createWriteStream('public/basker-export.zip');

  const archive = archiver('zip', {
      zlib: 9,
  });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function() {
      console.log(archive.pointer() + ' total bytes for export');
  });


  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', function(err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
  });

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
      throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);

  // append files from a sub-directory, putting its contents at the root of archive
  archive.directory('export/', false);

  // finalize the archive (ie we are done appending files but streams have to finish yet)
  // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
  archive.finalize();
}

