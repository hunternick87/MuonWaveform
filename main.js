import { createInterface } from 'readline';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline'
import fs from 'fs';
import path from 'path';

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
let last_adc = 0;

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
    portName = await waitForInput("Enter the port name (COM3, COM4): ");
    amplitude = await waitForInput("Starting amplitude: ");
    offset = await waitForInput("Starting offset: ");
    count_change = await waitForInput("How many counts till amplitude change (200): ");

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
    let adc = Number(data.split(',,')[5])
    if (adc > (last_adc + 200)) { return; }

    last_adc = adc;
    count++;
    if (just_save_adc) {
        //fs.appendFileSync('data.csv', `${data.split(' ')[3]}\n`);
        writeFile(`${data.split(' ')[3]}\n`,'main')
    } else {
        const a = data.split(' ').join(',');
        writeFile(`${a}\n`,'main')
        //fs.appendFileSync('data.csv', `${a}\n`);
    }
    //console.log(data.split(',,')[5])
    adc_array.push(adc)
    const old_adc_sum = adc_sum;
    adc_sum += adc
    adc_count++
    //console.log(count, (Number(count) % 20) == 0)
    if ((count % count_change) == 0) {
        console.log(adc_sum)
        const adc_avg = adc_sum / adc_count;
        adc_sum = 0;
        adc_count = 0;
        const adc_sd = getStandardDeviation(adc_array);
        adc_array = [];
        console.log('avg: ', adc_avg, ", sd: ", adc_sd);
        writeFile(`avg: ${adc_avg}, sd: ${adc_sd}, amp: ${amplitude}, offset: ${offset}\n`,'sub')
        console.log(`${count_change} counts saved to file`);
        await waitForNewAmplitude(); // Wait for new amplitude
        //fs.appendFileSync('data.csv', `New amplitude ${amplitude}mV\n`);
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

    let new_amplitude = Number(amplitude) + 2.2;
    let new_offset = Number(offset) + (-0.2);

    console.log(`New Amplitude: ${new_amplitude}`)
    console.log(`New Offset: ${new_offset}`)

    await waitForInput("Has the amplitude been updated? (Y, n): ");
    amplitude = new_amplitude;
    offset = new_offset

    main_file_name = `data-${amplitude}mV.csv`
    waiting = false;
}

function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}


WriteToFile()
