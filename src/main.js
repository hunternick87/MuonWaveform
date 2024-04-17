import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline'
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getStandardDeviation, startLoading, stopLoading, waitForInput, wait, checkForOldFiles, cleanDir, isRunning } from './utils.js';
import * as con from './constants.js';

export let c_count = 0;
export let current_cycle = 1;  // start at 1 because the first cycle is the initial cycle
export let max_cycles = 1;
let portName;
let count_change = 200;
let amplitude = 0;
let offset = 0;
let count = 0;
let waiting = false;
let adc_sum = 0;
let adc_count = 0;
let adc_array = [];
export let main_file_name = '';
export let sub_file_name = 'main';
let last_adc = 53;
let automatic = false;
let visa = null;

// async function cleanDir() {
//     const dir = path.resolve(`./files`)
//     const files = fs.readdirSync(dir);
//     console.log(`This will delete every file in ${dir}`);
//     const check = await waitForInput("Are you sure? (y/n)");
//     if (check == ("y")) {
//         fs.writeFileSync(sub_file_name, '')
//         for (const file of files) {
//             const fi = dir + '/' + file;
//             fs.rmSync(fi);
//         }
//     } else {
//         return;
//     }
// }

function writeFile(message, file_type) {
    if (file_type == 'main') {
        const file = path.resolve(`./files/${main_file_name}`)
        if (!fs.existsSync(file)) { fs.writeFileSync(file, '') }
        try {
            fs.appendFileSync(file, message);
        } catch {
            console.log(chalk.red('\nError writing to file. Please check if the file is open in another program.\n'));
            if (con.create_new_file_on_error) {
                const file_name = main_file_name.split('.');
                const new_file = path.resolve(`./files/${file_name[0]}-${Date.now()}.${file_name[1]}`)
                if (!fs.existsSync(new_file)) { fs.writeFileSync(new_file, '') }
                fs.appendFileSync(new_file, message);
            }
        }
    } else if (file_type == 'sub') {
        if (!fs.existsSync(sub_file_name)) { fs.writeFileSync(sub_file_name, '') }
        fs.appendFileSync(sub_file_name, message);
    }
}

async function WriteToFile() {
    const file = path.resolve(`./files`)
    if (!fs.existsSync(file)) { fs.mkdirSync(file); }
    const hasFiles = await checkForOldFiles();
    if (hasFiles) {
        let checkIfClear = await waitForInput("Clear old data files? (y/n): ")
        if (checkIfClear == ('y')) { await cleanDir(); }
    }
    amplitude = await waitForInput("Starting amplitude: ");
    offset = await waitForInput("Starting offset: ");
    count_change = await waitForInput("How many counts till amplitude change (200): ");
    if (con.advanced_mode) {
        portName = await waitForInput("Enter the port name (COM3, COM4): ");
        last_adc = await waitForInput("Base adc (53): ");
    }
    let automaticQ = await waitForInput("Should the program automatically change the amplitude? (y/n): ");
    if (automaticQ == 'y') { automatic = true; }
    if (automatic) {
        visa = getVisa();
        max_cycles = await waitForInput("How many cycles should the code run for? (1): ");

        const current_amplitude = visa.getAmplitude();
        const current_offset = visa.getOffset();

        if (current_amplitude != amplitude || current_offset != offset) {
            console.log('Warning: The current amplitude and offset are not the same as the starting amplitude and offset.')
            const check = await waitForInput("Do you want to overwrite with the inputted values? (y/n): ");
            if (check == 'n') {
                amplitude = current_amplitude;
                offset = current_offset;
            } else {
                visa.setAmplitude(amplitude);
                visa.setOffset(offset);
            }
        }

    }

    main_file_name = `data-${amplitude}mV.csv`

    if (con.main_file_type == 'readable') {
        writeFile(`cycle: [ adc average, adc standard deviation, amplitude, offset ]\n`, 'sub');
    } else {
        writeFile(`cycle,adc average,adc standard deviation,amplitude,offset\n`, 'sub');
    }

    const port = new SerialPort({ path: portName, baudRate: 9600 });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on('open', () => {
        console.log('Connected to Arduino');
        parser.on('data', (data) => {
            parseData(data)
        });
    });

    port.on('error', (err) => {
        console.error('Error:', err.message);
    });
}

async function parseData(data) {
    if (!data.includes("count")) { return console.log(data); } // Arduino header
    if (waiting) { return; }
    if (!isRunning()) {
        await startLoading();
    }
    let adc = Number(data.split(',,')[5])
    if ((last_adc != 0) && (adc > (last_adc + (last_adc * 0.3)))) { return; }
    last_adc = adc;
    count++;
    
    writeFile(`${data}\n`, 'main');

    adc_array.push(adc)
    adc_sum += adc
    adc_count++
    c_count++
    if ((count % count_change) == 0) {
        current_cycle++;
        stopLoading();
        const adc_avg = adc_sum / adc_count;
        adc_sum = 0;
        adc_count = 0;
        const adc_sd = getStandardDeviation(adc_array);
        adc_array = [];
        if (con.main_file_type == 'readable') {
            writeFile(`${current_cycle}: [ avg: ${adc_avg}, sd: ${adc_sd}, amp: ${amplitude}, offset: ${offset} ]\n`, 'sub');
        } else {
            writeFile(`${current_cycle},${adc_avg},${adc_sd},${amplitude},${offset}\n`, 'sub');
        }
        if (current_cycle > max_cycles) { await finish(); }
        if (automatic) {
            await automaticChange();
        } else {
            await waitForNewAmplitude(); 
        }
        c_count = 0;
        startLoading();
    }
}

async function automaticChange() {
    waiting = true;
    const current_amplitude = visa.getAmplitude();
    const current_offset = visa.getOffset();

    const new_amplitude = getNewAmplitude();
    const new_offset = getNewOffset();

    visa.setAmplitude(new_amplitude);
    visa.setOffset(new_offset)

    await wait(1000);

    amplitude = Number(new_amplitude.toFixed(2));
    offset = Number(new_offset.toFixed(2));

    main_file_name = `data-${amplitude}mV.csv`
    waiting = false;
}

async function waitForNewAmplitude() {
    waiting = true;
    console.log('Waiting for new amplitude...');

    let new_amplitude = Number((Number(amplitude) + 2.2).toFixed(2));
    let new_offset = Number((Number(offset) + (-0.2)).toFixed(2));

    console.log(`New Amplitude: ${new_amplitude}`)
    console.log(`New Offset: ${new_offset}`)

    await waitForInput("Has the amplitude been updated? (Y, n): ");
    amplitude = Number(new_amplitude.toFixed(2));
    offset = Number(new_offset.toFixed(2));

    main_file_name = `data-${amplitude}mV.csv`
    waiting = false;
}

async function finish() {
    console.log('Finished running cycles');
    if (visa) { visa.close(); }
    process.exit();

}

function getNewAmplitude() {
    const newAmplitude = Number((Number(amplitude) + 2.2).toFixed(2));
    return newAmplitude;
}

function getNewOffset() {
    const newOffset = Number((Number(offset) + (-0.2)).toFixed(2));
    return newOffset;
}


WriteToFile()