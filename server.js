// Import required modules
const express = require("express"); // Express framework for handling HTTP requests
const dotenv = require("dotenv"); // dotenv module to manage environment variables
const bodyParser = require("body-parser"); // Middleware for parsing incoming request bodies
const path = require("path"); // Module to handle and transform file paths
const mongoose = require("mongoose"); // Mongoose for MongoDB object modeling
const http = require("http"); // Native HTTP module to create a server
const { Server } = require("socket.io"); // Socket.IO for real-time communication

// Load environment variables from a .env file
dotenv.config();

// Initialize the Express app
const app = express();

// Create an HTTP server to integrate with Socket.IO
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server for real-time communication
const io = new Server(server);

// Middleware to parse JSON and URL-encoded data from client requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define the server's port, using an environment variable if available, default to 3000
const PORT = process.env.PORT || 3000;

// MongoDB connection URI from environment variable, with a fallback URI for local setup
const mongoURI = process.env.MONGO_URI || "your-default-mongodb-uri-here";

// Connect to MongoDB using Mongoose
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true }) // Connection options for MongoDB
  .then(() => console.log("Connected to MongoDB")) // Log success
  .catch((err) => console.error("Error connecting to MongoDB:", err)); // Log error if connection fails

// Define the schema for the form responses
const responseSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name field, required
  rollno: { type: String, required: true }, // Roll number field, required
  branch: { type: String, required: true }, // Branch field, required
  college: { type: String, required: true }, // College field, required
  phno: { type: String, required: true }, // Phone number field, required
  timestamp: { type: Date, default: Date.now }, // Timestamp for when the response was created
});

// Create a Mongoose model based on the schema
const Response = mongoose.model("Response", responseSchema);

// Serve the index.html file when the root route is accessed
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html")); // Send the HTML file in the response
});

// Handle the form submission at the /submit route (POST request)
app.post("/submit", async (req, res) => {
  // Destructure the incoming request body to get form data
  const { name, rollno, branch, college, phno } = req.body;

  // Check if all required fields are provided
  if (!name || !rollno || !branch || !college || !phno) {
    return res.status(400).json({ message: "All fields are required." }); // Send a 400 error if any field is missing
  }

  try {
    // Create a new response document using the data received from the client
    const response = new Response({ name, rollno, branch, college, phno });

    // Save the response to the database and await the result
    const savedResponse = await response.save();

    // Log the saved response to the console
    console.log("Data saved to MongoDB:", savedResponse);

    // Emit an 'update' event to all connected clients with the saved response data
    io.emit("update", savedResponse);

    // Send a success response with the saved data to the client
    res.status(200).json({
      message: "Data received and saved successfully!",
      data: savedResponse,
    });
  } catch (error) {
    // Log any errors that occur during data saving
    console.error("Error saving data to MongoDB:", error);

    // Send a 500 error response if there was a failure in saving data
    res.status(500).json({ message: "Failed to save data." });
  }
});

// Socket.IO connection event: Fired when a client connects to the server
io.on("connection", (socket) => {
  // Log the client ID when a new client connects
  console.log("A client connected:", socket.id);

  // Listen for an 'edit' event from the client (for real-time updates)
  socket.on("edit", async (data) => {
    try {
      // Find the response by ID and update it with the new data
      const updatedResponse = await Response.findByIdAndUpdate(data._id, data, {
        new: true,
      });

      // If the response was updated, broadcast the updated data to all connected clients
      if (updatedResponse) {
        io.emit("update", updatedResponse);
      }
    } catch (error) {
      // Log any errors that occur during the update process
      console.error("Error updating data:", error);
    }
  });

  // Handle the disconnection of a client
  socket.on("disconnect", () => {
    // Log when a client disconnects
    console.log("A client disconnected:", socket.id);
  });
});

// Start the server and listen on the defined port
server.listen(PORT, () => {
  // Log the server startup message
  console.log(`Server is running on http://localhost:${PORT}`);
});
