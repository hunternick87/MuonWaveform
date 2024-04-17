This can be used to get the calibration data for the cosmic watch muon detector.

This program connects to a Keysight 33500B Series Waveform Generator and cycles through a wave form with icrementing amplitude and offset. It reads the data from the cosmic watch muon detector and saves it locally to a file for later analysis then automatically changed the waveform on the waveform generator. 

General variables will be asked during setup however more advanced settings can be changed in the constants.js file.
During / after running the programs some files will be created, a main.txt (or main.csv) in the root directory and a folder called files with the raw data files.

For the muon detector you need to make sure the print out line is exactly like this:
```
Serial.println((String)count + " " + time_stamp+ " " + adc+ " " + sipm_voltage+ " " + measurement_deadtime+ " " + temperatureC);
```
This is the default print out line for the muon detector. If you have a different print out line you will need to change the code on the arduino.








# What this program exactly does
First it asks the user for a veraity of settings such as the starting amplitude, offset, and some other things. Then it connects to the arduino on the muon detector though its serial port and waits for it to return data. At this point if the user set the program to run automatically it will connect to the waveform generator though the NI-VISA library and set the current amplitude and offset. 

It will then wait for the muon detector to return data and save all of the data into multiple files in the data directory, it will though out any adc data that is over 30% of the previous adc value. This was done because durring testing we saw massive one time spikes in adc going from 53 to over 700 back down to 53. It will then save the data till it reaches a certain number of counts that are set by the user. For reference this is not the current count on the muon detector, this is a internal count that increments when ever proper data is received from the muon detector, this also does not include the throw out data from a high adc value. 

Once it does it will run a few calculations such as the average adc value, the standard deviation. It will then save this data to a file in the root directory. If the user set the program to run automatically it will communicate with the waveform generator and increment the amplitude and offset. Otherwise it will wait for the user to change the amplitude and offset on the waveform generator with the given values and for the user to confirm that they have changed the values. It will then repeat the process till the user stops the program or the program reaches the set number of cycles.










# Things needed
- USB A to B cable
- Ethernet cable



# Keysight 33500B Series Waveform Generator
page 231
https://www.keysight.com/us/en/assets/9018-03290/user-manuals/9018-03290.pdf?success=true

https://www.keysight.com/us/en/search.html/33500B
https://www.keysight.com/us/en/support/335ARB1U/arb-upgrade-1-channel-33500b-series-waveform-generators.html#


# SCPI Language
https://rfmw.em.keysight.com/spdhelpfiles/33500/webhelp/us/content/__I_SCPI/00%20scpi_introduction.htm

# Arduino
https://www.arduino.cc/reference/en/language/functions/communication/serial/read/

# Github Examples
https://github.com/morgan-at-keysight

# VISA SCPI for Javascript
https://github.com/Jorgen-VikingGod/visa32

# VISA SCPI for Matlab
https://github.com/gerardoRO/Keysight-Function-Generator


# Other
https://github.com/imabot2/serialib