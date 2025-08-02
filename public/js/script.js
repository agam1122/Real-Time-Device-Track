mapboxgl.accessToken = MAPBOX_TOKEN;

const socket = io();

let map;
const markers = {};

// Ask username using modal
function askUserName() {
  return new Promise((resolve) => {

    
    const modal = document.getElementById("nameModal");
    const input = document.getElementById("nameInput");
    const button = document.getElementById("submitNameBtn");

    modal.style.display = "flex";
    input.focus();

    const handleSubmit = () => {
      const name = input.value.trim();
      if (name !== "") {
        localStorage.setItem("userName", name);
        modal.style.display = "none";
        resolve(name);
      } else {
        input.placeholder = "Name is required!";
        input.classList.add("error");
      }
    };

    button.onclick = handleSubmit;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSubmit();
    });
  });
}


// Function to make accuracy circle around the marker
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
  ret.push(ret[0]);

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ret],
    },
  };
}

function addAccuracyCircle(id, lngLat, accuracy) {
  const circle = makeCircle(lngLat, accuracy || 15);

  if (map.isStyleLoaded()) {
    if (!map.getSource(`accuracy-${id}`)) {
      map.addSource(`accuracy-${id}`, {
        type: "geojson",
        data: circle,
      });
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
    map.on("load", () => {
      if (!map.getSource(`accuracy-${id}`)) {
        map.addSource(`accuracy-${id}`, {
          type: "geojson",
          data: circle,
        });
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
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Get current position and initialize the map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        
        askUserName().then((name) => {
          userName = name;

          const { latitude, longitude } = position.coords;

          map = new mapboxgl.Map({
            attribution: "&copy; Agam Partap Singh",
            container: "map",
            style: "mapbox://styles/mapbox/streets-v12", // Satellite view
            center: [longitude, latitude],
            zoom: 18,
            attributionControl: false, // Disable the default Mapbox attribution
          });

          // Add custom attribution control
          map.addControl(
            new mapboxgl.AttributionControl({
              compact: true,
              customAttribution: "© Agam Partap Singh",
            })
          );

          // Emit location to server
          socket.emit("send-location", { latitude, longitude, name: userName });

          // Watch for movement
          navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude, accuracy } = position.coords;
              socket.emit("send-location", {
                latitude,
                longitude,
                accuracy,
                name: userName,
              });
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
      },
      (error) => {
        console.error(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );
  }
});

// Handle receiving location
socket.on("receive-location", (data) => {
  const { id, latitude, longitude, name, accuracy } = data;

  const lngLat = [longitude, latitude];

  if (markers[id]) {
    markers[id].setLngLat(lngLat);

    // Update circle source if exists
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

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    markers[id].remove();
    delete markers[id];
  }
});
