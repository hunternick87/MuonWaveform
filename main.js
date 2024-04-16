import { createInterface } from 'readline';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline'
import fs from 'fs';
import path from 'path';
import { clearInterval } from 'timers';

const rl = createInterface({ input: process.stdin, output: process.stdout });
async function waitForInput(question) {
    return new Promise(resolve => {
        rl.question(question, (input) => {
            resolve(input.trim());
        });
    });
}


let portName;
let count_change = 200;
let amplitude = 0;
let offset = 0;
let just_save_adc = false;
let count = 0;
let waiting = false;
let adc_sum = 0;
let adc_count = 0;
let adc_array = [];
let main_file_name = '';
let sub_file_name = 'main.txt';
let last_adc = 53;
let running = false;

async function cleanDir() {
    const dir = path.resolve(`./files`)
    const files = fs.readdirSync(dir);
    console.log(`This will delete every file in ${dir}`);
    const check = await waitForInput("Are you sure? (y/n)");
    if (check == ("y")) {
        fs.writeFileSync(sub_file_name, '')
        for (const file of files) {
            const fi = dir + '/' + file;
            fs.rmSync(fi);
        }
    } else {
        return;
    }
}

function writeFile(message, file_type) {
    if (file_type == 'main') {
        const file = path.resolve(`./files/${main_file_name}`)
        if (!fs.existsSync(file)) { fs.writeFileSync(file, '') }
        fs.appendFileSync(file, message);
    } else if (file_type == 'sub') {
        if (!fs.existsSync(sub_file_name)) { fs.writeFileSync(sub_file_name, '') }
        fs.appendFileSync(sub_file_name, message);
    }
}

async function WriteToFile() {
    let checkIfClear = await waitForInput("Clear old data files? (y/n): ")
    if (checkIfClear == ('y')) {
        await cleanDir();
    }
    portName = await waitForInput("Enter the port name (COM3, COM4): ");
    amplitude = await waitForInput("Starting amplitude: ");
    offset = await waitForInput("Starting offset: ");
    count_change = await waitForInput("How many counts till amplitude change (200): ");
    last_adc = await waitForInput("Base adc (53): ");

    main_file_name = `data-${amplitude}mV.csv`

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
    if (!running) {
        await startLoading(); // Wait for loading animation to start
    }
    let adc = Number(data.split(',,')[5])
    if ((last_adc != 0) && (adc > (last_adc + (last_adc * 0.3)))) { return; }
    last_adc = adc;
    count++;
    
    writeFile(`${data}\n`, 'main');

    adc_array.push(adc)
    adc_sum += adc
    adc_count++
    if ((count % count_change) == 0) {
        stopLoading();
        console.log(adc_sum);
        const adc_avg = adc_sum / adc_count;
        adc_sum = 0;
        adc_count = 0;
        const adc_sd = getStandardDeviation(adc_array);
        adc_array = [];
        console.log('avg: ', adc_avg, ", sd: ", adc_sd);
        writeFile(`avg: ${adc_avg}, sd: ${adc_sd}, amp: ${amplitude}, offset: ${offset}\n`, 'sub');
        console.log(`${count_change} counts saved to file`);
        await waitForNewAmplitude(); // Wait for new amplitude
        startLoading();
    }
}



async function waitForNewAmplitude() {
    waiting = true;
    // let new_amplitude = 0;
    // let new_offset = 0;
    console.log('Waiting for new amplitude...');
    // const changeOffset = await waitForInput("Change offset or Amplitude? (Y, n): ");
    // if (changeOffset == ('N'||'n')) {
    //     new_amplitude = Number(amplitude) + 2;
    //     new_offset = offset;
    //     await waitForInput("Has the amplitude been updated? (Y, n): ");
    // } else if (changeOffset == ('Y'||'y')) {
    //     offset = await waitForInput("New offset: ");
    //     new_amplitude = await waitForInput("New amplitude: ");
    // }

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

function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

let loader = null;

async function startLoading() {
    return new Promise(resolve => {
        running = true;
        const P = ['\\', '|', '/', '-'];
        const D = ['.  ', '.. ', '...']
        let x = 0;
        let y = 0
        loader = setInterval(() => {
            process.stdout.write(`\r${P[x++]} Loading${D[y++]}          On count: ${count + 1}`);
            x %= P.length;
            y %= D.length;
        }, 500);
        resolve();
    });
}

function stopLoading() {
    clearInterval(loader)
}

WriteToFile()
