import { createInterface } from 'readline';
import { clearInterval } from 'timers';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { c_count, current_cycle, max_cycles, main_file_name, sub_file_name } from './main.js';
import * as con from './constants.js';

// Running status

let loader = null;

export async function startLoading() {
    return new Promise(resolve => {
        setRunning(true)
        const P = ['\\', '|', '/', '-'];
        let x = 0;
        loader = setInterval(() => {
            process.stdout.write(`\r${P[x++]} Running - Count: ${c_count + 1}, Cycle: [${current_cycle}/${max_cycles}]`);
            x %= P.length;
        }, 500);
        resolve();
    });
}

export function stopLoading() {
    clearInterval(loader)
}

// running status

let running = false;

export function isRunning() {
    return running;
}

export function setRunning(value) {
    running = value;
}

// Stardard deviation

export function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}


// Wait for input

const rl = createInterface({ input: process.stdin, output: process.stdout });
export async function waitForInput(question) {
    return new Promise(resolve => {
        if (question.startsWith(':')) {
            console.log(chalk.yellow(question.substring(1)));
            resolve('');
        } else {
            rl.question(question, (input) => {
                resolve(input.trim());
            });
        }
    });
}

// Wait for time

export async function wait(time) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}

// file system

export async function cleanDir() {
    const dir = path.resolve(`./files`)
    const files = fs.readdirSync(dir);
    console.log(chalk.red(`This will delete every file in ${dir}`));
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

export async function checkForOldFiles() {
    const dir = path.resolve(`./files`)
    const files = fs.readdirSync(dir);
    let noFiles = true;
    let noMain = true;
    if (files.length > 0) { noFiles = false; }
    const main_file_txt = fs.existsSync(path.resolve(`./main.txt`));
    const main_file_csv = fs.existsSync(path.resolve(`./main.csv`));
    if (main_file_txt || main_file_csv) { noMain = false; }
    if (noFiles || noMain) return false;
    return true;
}

// function writeFile(message, file_type) {
//     if (file_type == 'main') {
//         const file = path.resolve(`./files/${main_file_name}`)
//         if (!fs.existsSync(file)) { fs.writeFileSync(file, '') }
//         try {
//             fs.appendFileSync(file, message);
//         } catch {
//             console.log(chalk.red('\nError writing to file. Please check if the file is open in another program.\n'));
//             if (con.create_new_file_on_error) {
//                 const file_name = main_file_name.split('.');
//                 const new_file = path.resolve(`./files/${file_name[0]}-${Date.now()}.${file_name[1]}`)
//                 if (!fs.existsSync(new_file)) { fs.writeFileSync(new_file, '') }
//                 fs.appendFileSync(new_file, message);
//             }
//         }
//     } else if (file_type == 'sub') {
//         if (!fs.existsSync(sub_file_name)) { fs.writeFileSync(sub_file_name, '') }
//         fs.appendFileSync(sub_file_name, message);
//     }
// }