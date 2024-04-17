import * as NiVisa from 'node-ni-visa'

class Visa {
    constructor() {
        this.driverSession = NiVisa.viOpenDefaultRM();
        this.device = NiVisa.viOpen(this.driverSession, 'USB0::0x0957::0x2707::MY52303496::INSTR')
    }

    getAmplitude() {
        const voltString = NiVisa.query(this.device, 'VOLTage:AMPLitude?\n')
        const voltmV = voltString.split('E')[0]
        return voltmV
    }

    getOffset() {
        const voltString = NiVisa.query(this.device, 'VOLTage:OFFSet?\n')
        const voltmV = voltString.split('E')[0]
        return voltmV
    }
    
    setAmplitude(amplitudeMillivolts) {
        NiVisa.viWrite(this.device, `VOLTage ${amplitudeMillivolts}mV\n`);
        return;
    }
    
    setOffset(offsetMillivolts) {
        NiVisa.viWrite(this.device, `VOLTage:OFFSet ${offsetMillivolts}mV\n`);
        return;
    }

    close() {
        NiVisa.viClose(this.device);
        NiVisa.viClose(this.driverSession);
    }
}

let _visa = null;

export default function getVisa() {
    if (!_visa) {  _visa = new Visa(); }
    return _visa;
}