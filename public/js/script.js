// Set your Mapbox access token injected from server via EJS template variable.
mapboxgl.accessToken = MAPBOX_TOKEN;

// Connect to the Socket.IO server
const socket = io();

let mySocketId = null; // Declare a global (within this script) variable

const userLocations = {}; // key: socket id, value: { lat, lng }

socket.on("connect", () => {
  mySocketId = socket.id;
  console.log("Connected with socket ID:", mySocketId);
  // Now we can use mySocketId anywhere later in this script
});

// Global map object and markers keyed by socket id
let map;
const markers = {};

/**
 * Show modal asking the user for their name.
 * Returns a Promise resolving to the entered name.
 */
function askUserName() {
  return new Promise((resolve) => {
    const modal = document.getElementById("nameModal");
    const input = document.getElementById("nameInput");
    const button = document.getElementById("submitNameBtn");

    // Show modal by adding class
    modal.classList.add("modal--visible");
    input.focus();

    input.classList.remove("error");
    input.placeholder = "Your name";

    const handleSubmit = () => {
      const name = input.value.trim();

      if (name !== "") {
        localStorage.setItem("userName", name);

        // Hide modal by removing class
        modal.classList.remove("modal--visible");

        button.onclick = null;
        input.removeEventListener("keydown", keyListener);

        resolve(name);
      } else {
        input.placeholder = "Name is required!";
        input.classList.add("error");
      }
    };

    const keyListener = (e) => {
      if (e.key === "Enter") handleSubmit();
    };

    button.onclick = handleSubmit;
    input.addEventListener("keydown", keyListener);
  });
}

/**
 * Creates a GeoJSON polygon circle centered at 'center' with the given radius in meters.
 */
function makeCircle(center, radiusInMeters, points = 64) {
  const coords = {
    latitude: center[1],
    longitude: center[0],
  };

  const km = radiusInMeters / 1000;
  const ret = [];

  const distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push(ret[0]); // close polygon

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ret],
    },
  };
}

/**
 * Adds or updates an accuracy circle on the map for a given user ID.
 */
function addAccuracyCircle(id, lngLat, accuracy) {
  const circle = makeCircle(lngLat, accuracy || 15);

  if (map.isStyleLoaded()) {
    if (!map.getSource(`accuracy-${id}`)) {
      map.addSource(`accuracy-${id}`, {
        type: "geojson",
        data: circle,
      });
    } else {
      // Update circle data if source exists
      map.getSource(`accuracy-${id}`).setData(circle);
    }

    if (!map.getLayer(`accuracy-layer-${id}`)) {
      map.addLayer({
        id: `accuracy-layer-${id}`,
        type: "fill",
        source: `accuracy-${id}`,
        paint: {
          "fill-color": "#007cbf",
          "fill-opacity": 0.1,
        },
      });
    }
  } else {
    // Defer until map is loaded
    map.on("load", () => addAccuracyCircle(id, lngLat, accuracy));
  }
}



let currentMapStyle = localStorage.getItem("mapStyle") || "mapbox://styles/mapbox/streets-v12";
document.getElementById("styleSelect").value = currentMapStyle;


/**
 * Starts the map app: initializes map, sends location to server,
 * and watches position updates.
 */
function startApp(userName, position) {
  const { latitude, longitude } = position.coords;

  map = new mapboxgl.Map({
    attribution: "&copy; Agam Partap Singh",
    container: "map",
    style: currentMapStyle,
    center: [longitude, latitude],
    zoom: 18,
    attributionControl: false,
  });

  map.addControl(
    new mapboxgl.AttributionControl({
      compact: true,
      customAttribution: "© Agam Partap Singh",
    })
  );

  // Emit initial position
  socket.emit("send-location", { latitude, longitude, name: userName });

  // Watch for subsequent position updates
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      socket.emit("send-location", {
        latitude,
        longitude,
        accuracy,
        name: userName,
      });
    },
    (err) => {
      console.error("Geolocation error:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    }
  );
}

// On page load, check for saved username or ask for it.
document.addEventListener("DOMContentLoaded", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const storedName = localStorage.getItem("userName");
      if (storedName) {
        startApp(storedName, position);
      } else {
        askUserName().then((name) => {
          startApp(name, position);
        });
      }

      document.getElementById("styleSelect").addEventListener("change", function()  {
        const selectedStyle = this.value;
        currentMapStyle = selectedStyle;
        if(map){
            map.setStyle(currentMapStyle);
        }
        
        localStorage.setItem("mapStyle", selectedStyle);

      })
    },
    (error) => {
      console.error("Geolocation error:", error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    }
  );
});



// Receive location updates from server and update markers
socket.on("receive-location", (data) => {
  const { id, latitude, longitude, name, accuracy } = data;
  const lngLat = [longitude, latitude];
  userLocations[id] = { latitude, longitude }; //Save location for later

  if (markers[id]) {
    markers[id].setLngLat(lngLat);

    if (map.getSource(`accuracy-${id}`)) {
      map
        .getSource(`accuracy-${id}`)
        .setData(makeCircle(lngLat, accuracy || 15));
    }
  } else {
    markers[id] = new mapboxgl.Marker()
      .setLngLat(lngLat)
      .setPopup(new mapboxgl.Popup().setText(`User: ${name}`))
      .addTo(map);

    addAccuracyCircle(id, lngLat, accuracy);
  }
});

// Remove marker and accuracy circle when user disconnects
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    markers[id].remove();
    delete markers[id];
  }
  if (map.getLayer(`accuracy-layer-${id}`)) {
    map.removeLayer(`accuracy-layer-${id}`);
  }
  if (map.getSource(`accuracy-${id}`)) {
    map.removeSource(`accuracy-${id}`);
  }
  delete userLocations[id];
});

// Listens for server's "user-list" event and update the sodebar
// "userArray" is expected to be an array of { id, name },
// e.g. [{ id: "abc123", name: "Alice" }, { id: "def999", name: "Bob" }]
socket.on("user-list", (userArray) => {
  const ul = document.getElementById("userList");
  ul.innerHTML = "";

  // Your own entry always at the top (if present)
  if (mySocketId) {
    const me = userArray.find((user) => user.id === mySocketId);
    if (me) {
      const li = document.createElement("li");
      li.textContent = me.name + " (You)";
      li.style.fontWeight = "bold";
      li.style.color = "#007cbf";
      li.dataset.userId = me.id; // set an attribute just in case

      //Add click handler
      li.onclick = () => {
        const loc = userLocations[me.id];
        if (loc && map) {
          map.flyTo({
            center: [loc.longitude, loc.latitude],
            zoom: 18,
            speed: 1.2,
          });
        }
      };

      ul.appendChild(li);
    }
  }

  // Add all other users (skip yourself)
  userArray.forEach((user) => {
    if (!mySocketId || user.id !== mySocketId) {
      const li = document.createElement("li");
      li.textContent = user.name;
      li.dataset.userId = user.id;

      //Add click handler
      li.onclick = () => {
        const loc = userLocations[user.id];
        if (loc && map) {
          map.flyTo({
            center: [loc.longitude, loc.latitude],
            zoom: 18,
            speed: 1.2,
          });
        }
      };

      ul.appendChild(li);
    }
  });
});

// Sidebar open/close on mobile
document.getElementById("sidebarToggle").onclick = () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarToggle").style.display = "none"; // Hide the toggle when sidebar is open
};

document.getElementById("sidebarClose").onclick = () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarToggle").style.display = "block"; // Show the toggle when sidebar is closed
};


document.getElementById("changeNameBtn").addEventListener("click", async () => {

    // Clear saved name
    localStorage.removeItem("userName");

    // disconnect and reconnect the socket to reset state
    socket.disconnect();

    // Ask for new userName
    const newName = await askUserName();

    // Restart the app with new name and current position
    if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(
            (position) => {
                startApp(newName, position);
                socket.connect();
            },
            (error) => {
                console.error(error);
                // Start with default/new name anyway
                // or alert user
            }
        )
    }

    alert("Name cleared! The app will reload for you to pick a new name.");
    window.location.reload();
})
