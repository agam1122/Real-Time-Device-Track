mapboxgl.accessToken = MAPBOX_TOKEN;

const socket = io();

let map;
const markers = {};

// Get current position and initialize the map
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      map = new mapboxgl.Map({
          attribution: "&copy; Agam Partap Singh",
          container: "map",
          style: "mapbox://styles/mapbox/streets-v12", // Satellite view
          center: [longitude, latitude],
          zoom: 18,
          attributionControl: false // Disable the default Mapbox attribution
      })

      // Add custom attribution control
      map.addControl(
        new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: "© Agam Partap Singh"
      })
);

      

      // Emit location to server
      socket.emit("send-location", { latitude, longitude });

      // Watch for movement
      navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          socket.emit("send-location", { latitude, longitude });
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

// Handle receiving location
socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;

  const lngLat = [longitude, latitude];

  if (markers[id]) {
    markers[id].setLngLat(lngLat);
  } else {
    markers[id] = new mapboxgl.Marker()
      .setLngLat(lngLat)
      .setPopup(new mapboxgl.Popup().setText(`User: ${id.slice(0, 4)}`))
      .addTo(map);
  }
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    markers[id].remove();
    delete markers[id];
  }
});
