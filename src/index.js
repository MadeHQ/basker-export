'use strict';

const { cpSync, createWriteStream, rmdirSync, readFileSync, writeFileSync } = require('fs');
const archiver = require('archiver');

const pluginName = '@madehq/pl-basker-export';
const safePluginName = '@madehq-pl-basker-export';

function addDownloadLink() {
  console.log('BASKER EXPORT: addDownloadLink');
  // Was hoping to do this via the `patternlab-pattern-write-end` hook but doesn't seem to work

  setTimeout(() => {
    // Inject the Link into the PL markup (REALLY HACKY I KNOW)
    const plViewerFile = 'public/styleguide/js/patternlab-viewer.modern.js';
    let plViewerContent = readFileSync(plViewerFile, 'utf8');
    if (plViewerContent.indexOf('Basker Export')) {
      console.log('BASKER EXPORT: Adds link');
      plViewerContent = plViewerContent.replace(/<li class="pl-c-tools__item">/, '<li class="pl-c-tools__item"><a class="pl-c-button pl-c-button--medium" href="/basker-export.zip">Basker Export</a></li><li class="pl-c-tools__item">');
      writeFileSync(plViewerFile, plViewerContent, 'utf8');
    }
  }, 2000);
}

/**
 * Define what hooks you wish to invoke to here
 * //todo change link
 * For a full list of hooks - check out https://github.com/pattern-lab/patternlab-node/wiki/Creating-Plugins#events
 * @param patternlab - global data store which has the handle to hooks
 */
function registerHooks(patternlab) {
  console.log('BASKER EXPORT: registerHooks', 'Regenerating ZIP causes a LOT of looping');
  // PATTERNLAB_PATTERN_WRITE_END Write ZIP
  // patternlab.hooks['patternlab-pattern-write-end'] = patternlab.hooks['patternlab-pattern-write-end'] ?? [];
  // patternlab.hooks['patternlab-pattern-write-end'].push(generateExportZip);
}

/**
 * A single place to define the frontend configuration
 * This configuration is outputted to the frontend explicitly as well as included in the plugins object.
 *
 */
function getPluginFrontendConfig() {
console.log('BASKER EXPORT: getPluginFrontendConfig');
    return {
        name: pluginName,
        templates: [],
        stylesheets: [],
        javascripts: [
        `patternlab-components/pattern-lab/${safePluginName}/js/${safePluginName}.js`,
        ],
        onready: 'PluginTab.init()',
        callback: '',
    };
}

/**
 * The entry point for the plugin. You should not have to alter this code much under many circumstances.
 * Instead, alter getPluginFrontendConfig() and registerEvents() methods
 */
function pluginInit(patternlab) {
    console.log('BASKER EXPORT: src/index.js - pluginInit');
    if (!patternlab) {
        console.error('patternlab object not provided to pluginInit');
        process.exit(1);
    }
    addDownloadLink(patternlab);
    //write the plugin json to public/patternlab-components
    const pluginConfig = getPluginFrontendConfig();

    //add the plugin config to the patternlab-object
    if (!patternlab.plugins) {
        patternlab.plugins = [];
    }
    patternlab.plugins.push(pluginConfig);

    generateExportZip(patternlab);

    //setup listeners if not already active. we also enable and set the plugin as initialized
    if (!patternlab.config.plugins) {
        patternlab.config.plugins = {};
    }

    //attempt to only register hooks once
    if (
        patternlab.config.plugins[pluginName] !== undefined &&
        patternlab.config.plugins[pluginName].enabled &&
        !patternlab.config.plugins[pluginName].initialized
    ) {
        //register hooks
        registerHooks(patternlab);

        //set the plugin initialized flag to true to indicate it is installed and ready
        patternlab.config.plugins[pluginName].initialized = true;
    }
}

module.exports = pluginInit;

function generateExportZip(patternlab) {
    console.log('Basker Export: START');

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
        rmdirSync('export', {recursive: true, force: true});
    } catch (e) {}

    // Creates `export` directory and copies files from `theme` into it
    cpSync('theme', 'export', {recursive: true});

    // Copies
    cpSync('source/_data/settings_schema.json', 'export/config/settings_schema.json', {recursive: true});

    // Copy Assets (possibly need to delete top level directories)
    cpSync('public/assets', 'export/assets', {recursive: true});



    // Generate the ZIP Export from the `export` directory
    const output = createWriteStream('public/basker-export.zip');
    const archive = archiver('zip', {
        zlib: 9,
    });

    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
    });

    // This event is fired when the data source is drained no matter what was the data source.
    // It is not part of this library but rather from the NodeJS Stream API.
    // @see: https://nodejs.org/api/stream.html#stream_event_end
    output.on('end', function() {
        console.log('Data has been drained');
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

    console.log('Basker Export: END');
}
