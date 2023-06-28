// https://careful-rose-yoke.cyclic.app
require('dotenv').config();

const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const port = process.env.PORT || 3000;
const Dbschema = require('./DBschema/DBschema');
const multitask = require('./routes/multitask');
var server = app.listen(port, listening);
var ip = require('ip');
var ipVar = ip.address();

//require('dotenv').config(); // Load environment variables from .env file


// Create a transporter
const transporter = nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: process.env.EMAIL_USER, // use environment variable
    pass: process.env.EMAIL_PASSWORD // use environment variable
  }
});


app.use(express.urlencoded({ extended: false}));
app.use(express.json());
app.use('/multitask', multitask);
app.use(express.static('landing'));
app.all('*', (req, res) => {res.status(404).send('<h1>404! Wrong Route, Sorry </h1>');}); 

//TIMING
const checkHour = 19;
const checkMinit = 20;
const intervalTime = 10000;
var date;
var isoDateTime;
var hour;
var min;
var checkDone = false;

//WEB Scraping elements GENERAL
const user = 'DebraFougere';
const pass = 'DebRapid123#';
const nameIdWeb = '#Label_22'; 
const tankIdWeb = '#Label_13';
const userInputId = '#username';
const passInputId = '#password';
const loginbutton = '#signinBtn';





    
//FUNCTIONS
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function listening() {
    console.log(`Server Live at ${ipVar}:${port}`);
}
function dateTime(){
    date = new Date();
    isoDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    return isoDateTime;
}
const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);
        mongoose.connect(process.env.MONGODB_URI);
        dateTime(); 
        console.log(`Connected to database at ${isoDateTime}`)
    } catch(error) {
        console.log(error);
        process.exit();
    }

    
}

async function scheduleReading(){
    date = new Date();
    isoDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    hour = date.getHours(); 
    min = date.getMinutes();
    
    
    if (hour === checkHour && min === checkMinit && checkDone === false) {
    console.log("Starting to read assets");
    assetsReading();
    checkDone = true;
    }
    if (min != checkMinit) {
        if(min != checkMinit && checkDone === true){
////////////////////////////////////////
        }
    checkDone = false; // this is to reset the condition to call on schedule once
    }

    
    //updatedChecker();

    
    

    
    
}

async function assetsReading(){

var apiData = await Dbschema.find({}).exec();

browser = await puppeteer.launch({headless: true, defaultViewport: null, ignoreDefaultArgs: ['--enable-automation'], args: ['--disable-setuid-sandbox'], 'ignoreHTTPSErrors': true });
const page = await browser.newPage();

for(let i = 0; i < apiData.length; i ++){

var loginlink = apiData[i].Asset.link + 'sdcard/cpt/app/signin.php';
var overviewLink = apiData[i].Asset.link + 'sdcard/cpt/app/graphic.php?grname=Boiler.gr';
var dbId = apiData[i].id; 
var name = apiData[i].Asset.name;
var online = false;
var error = false;
var tankVolume;
var fuelDaysRemaining;


    try{//try to check if its online
        await page.goto(loginlink, {waitUntil: "domcontentloaded"});
        
                        try{
                            console.log(`Asset ${name} is Online`)
                            await Dbschema.updateOne({_id: dbId}, {$set:{"Asset.status": true}})

                            await page.waitForSelector(userInputId);
                            await page.type(userInputId, user, {delay: 50});
                            await page.type(passInputId, pass, {delay: 50});
                            console.log(`Loging in...`)
                            await page.click(loginbutton);
                            await page.waitForNavigation();
                            await page.goto(overviewLink, {waitUntil: "domcontentloaded",});
                            console.log('awaiting Web');
                            await delay(3000);
                            await page.waitForSelector(nameIdWeb);


                            //name = await page.$$eval(nameIdWeb, name => name.map( name => name.innerText));
                            tankVolume = await page.$$eval(tankIdWeb, tankVolume => tankVolume.map( tankVolume => tankVolume.innerText));

                        
                            tankVolume = tankVolume[0];
                            tankVolume = tankVolume.substring(22, 26);
                            tankVolume = Number(tankVolume);
                            if(isNaN(tankVolume)){
                                    tankVolume = 0;
                                    console.log(`Tank level is not a number at ${name}`);
                            }
                            
                            console.log(tankVolume);
                            try{// update errors status
                                await Dbschema.updateOne({_id: dbId}, {$set:{"Asset.errors": false}});
                            } catch(err){
                                console.log(`Db error at ${name} at error update script`);
                            }

                            try{
                                dateTime();
                                await Dbschema.updateOne({_id: dbId}, {$push:{"Asset.data.fuelLevel": tankVolume, "Asset.data.updated": isoDateTime}});
                            } catch(err){
                                console.log(`Db error at ${name} updating tankvolume`);
                                return(err);
                            }
                            

                            console.log('');
                            console.log('');
                            
                                    
                            


                        } catch(err){ //Catching an internal error 
                            console.log(err);
                            console.log(`internal error at ${name} = true`)
                            try{// update erros status
                                await Dbschema.updateOne({_id: dbId}, {$set:{"Asset.errors": true}});
                            } catch(err){
                                console.log(`Db error at ${name} at error update script`);
                            }
                        }


    }catch(err){//catch to check if its offline
        console.log(`Asset ${name} is Offline`);
        console.log('');
        console.log('');
                        try{
                            await Dbschema.updateOne({_id: dbId}, {$set:{"Asset.status": false}})
                        } catch(err){
                            console.log(`Db error at ${name} at offline update script`)
                        }
    }

    if(i+1 == apiData.length){
        console.log(`all assets done total = ${apiData.length}`);
        // Compose email
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO, 
        subject: 'Your Server reading the assets',
        text: `the array count was ${i+1}`
    };
  
    // Send email
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
        console.log(error);
        } else {
        console.log('Email sent: ' + info.response);
        }
    });
  
    }
}

await browser.close();
return;
}



// FUNCTIONS END




connectDB();

setInterval(scheduleReading, intervalTime);

assetsReading();












