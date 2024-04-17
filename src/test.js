import { SerialPort } from 'serialport';
import { createInterface } from 'readline';

const data = await SerialPort.list();
console.log(data);
