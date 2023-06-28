require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const router = express.Router();
const Dbschema = require('../DBschema/DBschema');
const nodemailer = require('nodemailer');
var date;
var isoDateTime;

function localdate(){
  date = new Date();
  isoDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString()
  
}



//get all  
router.get('/', (req, resp) => {

  Dbschema.find({}).then((res) => {
    resp.send(res);
  }).catch((err) => {
    //catch error
  });

}); 

//run pupperteer  
router.get('/readassets', async (req, resp) => {
  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

//WEB Scraping elements GENERAL
const user = 'DebraFougere';
const pass = 'DebRapid123#';
const nameIdWeb = '#Label_22'; 
const tankIdWeb = '#Label_13';
const userInputId = '#username';
const passInputId = '#password';
const loginbutton = '#signinBtn';


  // Create a transporter
const transporter = nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: process.env.EMAIL_USER, // use environment variable
    pass: process.env.EMAIL_PASSWORD // use environment variable
  }
});

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
                            await delay(1000);
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
                              localdate();
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

    if(i+1 == 3){//apiData.length
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
    resp.status(200).send(`All done assets: ${apiData.length} and email sent`);
    }
}

await browser.close();
return;

}); 

//update from our form  
router.post('/update', async (req, res) => {

try{
const id = req.body.id;
const location = req.body.location;


//inserting data into DB

try{
  await Dbschema.updateOne({_id: id}, {$set:{"Asset.location": location}})
  console.log(`New Location inserted (${location})`);
} catch(err){
  console.log(`Db error at ${id} at updating route`);
}




//res.end();
res.status(200).send('OK');
}
catch(error) {
  console.error('Error handling POST request:', error);
  res.status(500).send('Internal Server Error');
}

}); 


//update from our form  
router.post('/appAndroid', async (req, res) => {

  try{
  console.log(req.body);
  //res.end();
  res.status(200).send('OK');
  }
  catch(error) {
    console.error('Error handling POST request:', error);
    res.status(500).send('Internal Server Error');
  }
  
  }); 

  

//get one
router.get('/:id', getSensors, (req, res) => {
    res.json(res.sensors);
  
});
/*
//get one with filters
router.get('/filter/:id', getSensors, (req, res) => {
 var setpoint = res.sensors.device.setpoint;
 var output = res.sensors.device.output;
 var alarmActive = res.sensors.device.alarmActive;
 var bundle = {setpoint,
                output,
                alarmActive}
 res.json(bundle);
 

    
  //let lastDate = dataDate[dataDate.length - 1];

  //console.log(lastDate);

});*/


//create one   this is working good
router.post('/create', async (req, res) => {
  localdate();
  var namePosted = req.body.name;
  var kwPosted = req.body.kw;
  var locationPosted = req.body.location;
  var linkPosted = req.body.link;
  var statusPosted = Boolean(req.body.status);
  var fuelLevelPosted = Number(req.body.fuelLevel);
  var errorPosted = req.body.errors;
  var fuelDaysRemainingPosted = req.body.fuelDaysRemaining;
  var tankCapacityPosted = Number(req.body.tankCapacity);
  //console.log({namePosted, kwPosted, linkPosted, statusPosted, fuelLevelPosted});
  
   
  
  const newAsset = new Dbschema({
        
        Asset: {
            name: namePosted,
            kw: kwPosted,
            location: locationPosted,
            link: linkPosted,
            status: statusPosted,
            errors: errorPosted,
            fuelDaysRemaining: fuelDaysRemainingPosted,
            tankCapacity: tankCapacityPosted,
            data: {fuelLevel: fuelLevelPosted, updated: isoDateTime}
              
          }
          
       
  })
  try{
      const saveAsset = await newAsset.save();
      res.status(201).json(saveAsset);
      console.log("Create ok");
  } catch (err) {
      res.status(400).json({message: err.message});
  }
});



// Deleting One
router.delete('/delete/:id', getSensors, async (req, res) => {
    try {
      await res.sensors.remove()
      res.json({ message: 'Device Deleted' })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  async function getSensors(req, res, next) {
    let sensors
    try {
      sensors = await DBschema.findById(req.params.id)
      if (sensors == null) {
        return res.status(404).json({ message: 'Cannot find this ID' })
      }
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  
    res.sensors = sensors
    next()
  }

 
 


module.exports = router