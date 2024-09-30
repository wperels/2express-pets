const validator = require("validator")
const nodemailer = require("nodemailer")
const sanitizeHtml = require("sanitize-html")
const { ObjectId } = require("mongodb")
const petsCollection = require("../db").db().collection("pets")
const contactsCollection = require("../db").db().collection("contacts")



const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {}
}



// include async to use await in doesPetExist
exports.submitContact = async function (req, res, next) {
  if (req.body.secret.toUpperCase() !== "PUPPY") {
    console.log("spam detected")
    return res.json({ message: "Sorry, we don't like spammers." })
  }

  if (typeof req.body.name != "string") {
    req.body.name = ""
  }

  if (typeof req.body.email != "string") {
    req.body.email = ""
  }

  if (typeof req.body.comment != "string") {
    req.body.comment = ""
  }

  if (!validator.isEmail(req.body.email)) {
    console.log("invalid email detected")
    return res.json({ message: "Sorry" })

  }

  // be sure to return to prevent any further processing
  if (!ObjectId.isValid(req.body.petId)) {
    console.log("invalid id detected")
    return res.json({ message: "Sorry, invalid ID detected." })

  }
  req.body.petId = new ObjectId(req.body.petId)
  const doesPetExist = await petsCollection.findOne({ _id: req.body.petId })

  if (!doesPetExist) {
    console.log("pet does not exist!")
    return res.json({ message: "Sorry" })

  }
  const ourObject = {
    petId: req.body.petId,
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions)
  }

  console.log(ourObject)

  var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD
    }
  })

  try {
    const promise1 = transport.sendMail({
      to: ourObject.email,
      from: "petadoption@localhost",
      subject: `Thank you for your interest in ${doesPetExist.name}`,
      html: `<h3 style="color: red;">Thanks for your feedback about, ${doesPetExist.name}!</h3>
      <p>${ourObject.comment}</p>`

    })

    const promise2 = transport.sendMail({
      to: "petadoption@localhost",
      from: "petadoption@localhost",
      subject: `Someone is interested in ${doesPetExist.name}`,
      html: `<h3 style="color: red;">New Contact! ${doesPetExist.name}!</h3>
      <p>Name: ${ourObject.name}<br>
      Pet Interest In:  ${doesPetExist.name}<br>
      Email: ${ourObject.email}<br>
      Comment: ${ourObject.comment}<br>
      </p>
      `
    })

    const promise3 = contactsCollection.insertOne(ourObject)


    await Promise.all([promise1, promise2, promise3])
  } catch (err) {
    next(err)
  }


  res.send("Thanks for sending data!")
}

exports.viewPetContacts = async (req, res) => {

  if (!ObjectId.isValid(req.params.id)) {
    console.log("bad id")
    return res.redirect("/")
  }

  const pet = await petsCollection.findOne({ _id: new ObjectId(req.params.id) })

  if (!pet) {
    console.log("pet does not exist")
    return res.redirect("/")
  }

  const contacts = await contactsCollection.find({ petId: new ObjectId(req.params.id) }).toArray()
  res.render("pet-contacts", { contacts: contacts, pet: pet })

}
