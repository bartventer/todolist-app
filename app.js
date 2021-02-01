/////////////////////////////////////////////////////////////
// IMPORTING THE MODULES
/////////////////////////////////////////////////////////////
const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js")
const mongoose = require("mongoose")
const _ = require("lodash");
const dotenv = require("dotenv");

// READING AND STORING ENVIRONMENT VARIABLES
dotenv.config();
const ATLAS_ADMIN_PASSWORD = process.env.ATLAS_ADMIN_PASSWORD;
const ATLAS_ADMIN_USERNAME = process.env.ATLAS_ADMIN_USERNAME;


/////////////////////////////////////////////////////////////
// CREATING THE APP
/////////////////////////////////////////////////////////////
const app = express();


/////////////////////////////////////////////////////////////
// SET UP EJS AS VIEW ENGINE
/////////////////////////////////////////////////////////////
app.set('view engine', 'ejs');


/////////////////////////////////////////////////////////////
// HANDLE POST REQUEST WITH BODY PARSER
/////////////////////////////////////////////////////////////
app.use(bodyParser.urlencoded({ extended: true }));


/////////////////////////////////////////////////////////////
// HANDLE STATIC FILES IN THE PUBLIC FOLDER
/////////////////////////////////////////////////////////////
app.use(express.static("public"));


/////////////////////////////////////////////////////////////
// SETTING UP MONGODB DATABASE
/////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////
// OPEN A CONNECTION TO THE DB
/////////////////////////////////////////////////////////////
mongoose.connect('mongodb+srv://'+ATLAS_ADMIN_USERNAME +':'+ ATLAS_ADMIN_PASSWORD+'@cluster0.ljolo.mongodb.net/todolistDB', {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false});

/////////////////////////////////////////////////////////////
// CREATE A NEW ITEM SCHEMA FROM WHICH TO DERIVE THE MODEL
/////////////////////////////////////////////////////////////
const itemsSchema = new mongoose.Schema({
  name: String,
  checkbox: {
    type: Number,
    default: 0
  }
});


/////////////////////////////////////////////////////////////
// COMPILE THE MONGOOSE SCHEMEA INTO A MODEL (COLLECTION)
/////////////////////////////////////////////////////////////
const Item = mongoose.model("Item", itemsSchema);


/////////////////////////////////////////////////////////////
// CREATING SOME DEFAULT MONGODB ITEMS TO START WITH
/////////////////////////////////////////////////////////////
const item1 = new Item({
  name: "Welcome to your todolist!"
});
const item2 = new Item({
  name: "Hit the + button to add a new item."
});
const item3 = new Item({
  name: "Hit this to delete an item ---> "
});

const defaultItems = [item1, item2, item3];

/////////////////////////////////////////////////////////////
// DEFAULT LIST SCHEMA AND MODEL
/////////////////////////////////////////////////////////////
const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);

/////////////////////////////////////////////////////////////
// HOME GET ROUTE TO DISPLAY TODOLIST
/////////////////////////////////////////////////////////////
app.get("/", function(req, res) {

const todaysDate = date.getDate();

  Item.find({}, function(err, foundItems){
    if(foundItems.length ===0){
      Item.insertMany(defaultItems, function(err){
        if (err){
          console.log(err);
        }else{
          console.log("Successfully saved default items to DB.");
          console.log("Being redirected to home page.");
          res.redirect("/");
        }
      });
    }else{
      console.log("Successfully rendered the list page; default items already added previously.");
    res.render("list", {listTitle: "Today",newListItems: foundItems, todaysDate:todaysDate});
    }
  });

});

/////////////////////////////////////////////////////////////
// HOME POST ROUTE TO ADD A NEW ITEM
/////////////////////////////////////////////////////////////
app.post("/", function(req, res){
  const itemName = req.body.newItem;
  const listName = req.body.listName;

  const item = Item({name: itemName});

  //If user is using the default list
  if (listName === "Today"){
  item.save();
  console.log("Item added to defualt list.");
  res.redirect("/");
}else{
  // If the user came from a custom list
  List.findOne({name: listName}, function(err, foundList){
    foundList.items.push(item);
    foundList.save();
    console.log("Item added to custom list.");
    res.redirect("/" + listName);
  });
}

});

/////////////////////////////////////////////////////////////
// DELETE ROUTE POST REQUEST
/////////////////////////////////////////////////////////////
app.post("/delete",function(req, res){
  console.log(req.body);
  const id = req.body.itemToDelete;
  const listName = req.body.listName;
  // User is using default list
  if(listName === "Today"){
    Item.findByIdAndRemove(id, function(err){
      if (err){
        console.log(err);
      }else{
        console.log("Item deleted from default list.");
        res.redirect("/");
          }
        });
  }else{
    // User is using custom list
    List.findOneAndUpdate({name: listName}, {$pull : {items: {_id: id}}}, function(err, foundList){
      if (!err){
        console.log("Item deleted from custom list.");
        res.redirect("/"+listName);
      }
    });
  }
    });


/////////////////////////////////////////////////////////////
// CHECKBOX ROUTE POST REQUEST
// IF THE CHECKBOX GETS TOGGLED, THEN THE DATABASE WILL BE
// UPDATED ACCORDINGLY
/////////////////////////////////////////////////////////////
app.post("/checkbox",function(req, res){

  const listName = req.body.listName;
  const id = req.body.item_id;

  // Using default home page list
  if (listName === "Today"){
    Item.findById(id, function(err, foundItem){

      // If doesn't contain strike through, then toggle on by updating the MongoDb Database to 1
      if(foundItem.checkbox===0){
        Item.findByIdAndUpdate(id, {$set: {checkbox:1}}, function(err, result){
          if(!err){
            console.log("Added strike-through.");
            res.redirect("/");
          }
        });
      }
      // If already contains a strike through, then toggle off by updating the MongoDb Database to 0
      else{
        Item.findByIdAndUpdate(id, {$set: {checkbox:0}}, function(err, result){
          if(!err){
            console.log("Removed strike-through.");
            res.redirect("/");
          }
        });
      }
      });
  }
  // Using a custom list
  else{
          // Check if item has strikethrough
          List.exists({name:listName, items: {$elemMatch: {_id:id, checkbox:1}}},function(err, foundItem){

            // If doesn't contain strike through, then toggle on by updating the MongoDb Database to 1
            if(foundItem===false){
              List.findOneAndUpdate(
                    {name:listName, "items._id": id},
                    {$set: { "items.$.checkbox": 1 }},
                    function(err, result){
                      if(!err){
                        console.log("Added strike-through.");
                        res.redirect("/"+listName);
                      }
                });

            // If already contains a strike through, then toggle off by updating the MongoDb Database to 0
            }else{

              List.findOneAndUpdate(
                         {name:listName, "items._id": id},
                         {$set: { "items.$.checkbox": 0 }},
                         function(err, result){
                           if(!err){
                              console.log("Removed strike-through.");
                              res.redirect("/"+listName);
                           }
                         });
            }
          });
      }
    });


/////////////////////////////////////////////////////////////
//CREATE A NEW LIST/ LOAD EXISTING LIST; OPTION 1: ENTER CUSTOM URL
// CUSTOM LIST GET ROUTE, WHICH WILL RENDER A NEW PAGE AND
// DATABSE BASED ON THE ROUTE PARAMATER ENTERED
/////////////////////////////////////////////////////////////
app.get("/:customListName", function(req, res){
  const customListName = _.capitalize(req.params.customListName).replace(/ /g, "");
  const todaysDate = date.getDate();

  List.findOne({name: customListName}, function(err, foundList){
    if (!err){
      if (!foundList){
        // Create a new list
        const list = new List({
          name: customListName,
          items: defaultItems
        });
        list.save(function(err, result) {
          console.log("New custom list created.");
          res.redirect("/" + customListName);
        });
      }else{
        // Show an existing list
        console.log("Loading existing custom list.");
        res.render("list", {listTitle: foundList.name, newListItems: foundList.items, todaysDate:todaysDate});
      }
    }
  });

});


/////////////////////////////////////////////////////////////
//CREATE A NEW LIST/ LOAD EXISTING LIST; OPTION 2: USE SEARCH BOX
/////////////////////////////////////////////////////////////
app.post("/cusomtListSearch", function(req, res){
  const customListName= req.body.customListName;
  console.log(customListName + " has been searched.");
  res.redirect("/"+customListName);
});


// ABOUT PAGE ROUTE
app.get("/about", function(req, res){
  res.render("about");
});

/////////////////////////////////////////////////////////////
// STARTING THE SERVER
/////////////////////////////////////////////////////////////
const LOCAL_PORT = process.env.LOCAL_PORT;
app.listen(process.env.Port || LOCAL_PORT, function() {
  console.log("Server started on port.");
});
