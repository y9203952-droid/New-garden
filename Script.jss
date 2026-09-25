// ======================================================
// SECRET GARDEN
// PRIVATE TWO-PERSON DRAWING + MESSAGE GARDEN
// ======================================================
//
// IMPORTANT:
// Your index.html must create `supabaseClient` BEFORE
// loading this script.js.
//
// Example in index.html:
//
// const supabaseClient = window.supabase.createClient(
//   SUPABASE_URL,
//   SUPABASE_KEY
// );
//
// NEVER put an sb_secret_ or service_role key here.
// ======================================================


// ======================================================
// ELEMENTS
// ======================================================

const garden = document.getElementById("garden");
const modal = document.getElementById("modal");
const gallery = document.getElementById("gallery");
const galleryGrid = document.getElementById("galleryGrid");
const toast = document.getElementById("toast");
const status = document.getElementById("status");

const canvas = document.getElementById("drawingCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

const drawColor = document.getElementById("drawColor");
const brushSize = document.getElementById("brushSize");
const eraserBtn = document.getElementById("eraserBtn");


// ======================================================
// APP STATE
// ======================================================

let flowers = [];
let toastTimer = null;

let drawing = false;
let erasing = false;

let currentUser = null;


// ======================================================
// TOAST
// ======================================================

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


// ======================================================
// STATUS
// ======================================================

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    }
  );
}


// ======================================================
// RANDOM POSITION
// ======================================================

function flowerPosition() {
  return {
    left: 12 + Math.random() * 76,
    bottom: 18 + Math.random() * 42
  };
}


// ======================================================
// POSITION NORMALIZER
// ======================================================

function normalizePosition(pos) {
  if (!pos) {
    return flowerPosition();
  }

  if (typeof pos === "string") {
    try {
      pos = JSON.parse(pos);
    } catch {
      return flowerPosition();
    }
  }

  const left = Number(pos.left);
  const bottom = Number(pos.bottom);

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(bottom)
  ) {
    return flowerPosition();
  }

  return {
    left: Math.max(5, Math.min(90, left)),
    bottom: Math.max(8, Math.min(62, bottom))
  };
}


// ======================================================
// DRAWING ON GARDEN
// ======================================================

function createFlower(data, index) {

  if (!data.drawing_data) {
    return;
  }

  const image =
    document.createElement("img");

  image.className =
    "drawing-image";

  image.src =
    data.drawing_data;

  image.alt =
    data.name ||
    "A drawing from our private garden";

  image.title =
    data.message ||
    data.name ||
    "A little drawing";

  image.draggable = false;

  const position =
    normalizePosition(data.pos);

  image.style.left =
    position.left + "%";

  image.style.bottom =
    position.bottom + "%";

  image.style.animationDelay =
    (index * 0.07) + "s";


  image.addEventListener(
    "click",
    function () {

      const title =
        data.name
          ? data.name + "\n\n"
          : "";

      showToast(
        title +
        (
          data.message ||
          "A little drawing for our garden. 🌿"
        )
      );

    }
  );


  garden.appendChild(image);
}


// ======================================================
// RENDER GARDEN
// ======================================================

function renderGarden() {

  if (!garden) return;

  garden
    .querySelectorAll(".drawing-image")
    .forEach(function (item) {
      item.remove();
    });


  flowers.forEach(
    createFlower
  );
}


// ======================================================
// RENDER GALLERY
// ======================================================

function renderGallery() {

  if (!galleryGrid) return;

  galleryGrid.innerHTML = "";


  if (!flowers.length) {

    galleryGrid.innerHTML = `
      <div class="empty">
        Nothing has been drawn yet.<br>
        Make the first little memory! 🌱
      </div>
    `;

    return;
  }


  [...flowers]
    .reverse()
    .forEach(function (item) {

      const card =
        document.createElement("div");

      card.className =
        "card";


      let image = "";

      if (item.drawing_data) {

        image = `
          <img
            class="card-image"
            src="${item.drawing_data}"
            alt="${escapeHtml(
              item.name ||
              "Garden drawing"
            )}"
          >
        `;

      }


      card.innerHTML = `
        ${image}

        <strong>
          ${escapeHtml(
            item.name ||
            "Little drawing"
          )}
        </strong>

        <small>
          ${escapeHtml(
            item.message ||
            "Just growing quietly 🌿"
          )}
        </small>
      `;


      galleryGrid.appendChild(card);

    });
}


// ======================================================
// GET CURRENT USER
// ======================================================

async function getCurrentUser() {

  if (
    !window.supabaseClient &&
    typeof supabaseClient === "undefined"
  ) {
    console.error(
      "Supabase client was not created."
    );

    return null;
  }


  const client =
    window.supabaseClient ||
    supabaseClient;


  const {
    data,
    error
  } = await client.auth.getUser();


  if (error) {

    console.error(
      "Auth error:",
      error
    );

    return null;
  }


  return data.user || null;
}


// ======================================================
// AUTH ERROR
// ======================================================

function showAuthError(message) {

  const element =
    document.getElementById(
      "authError"
    );

  if (element) {
    element.textContent =
      message || "";
  }
}


// ======================================================
// UPDATE AUTH UI
// ======================================================

async function updateAuthUI(session) {

  const authScreen =
    document.getElementById(
      "authScreen"
    );

  currentUser =
    session?.user || null;


  if (currentUser) {

    if (authScreen) {
      authScreen.classList.add(
        "hidden"
      );
    }

    showAuthError("");

    setStatus(
      "Loading your private garden…"
    );

    await loadFlowers();

    return;
  }


  if (authScreen) {
    authScreen.classList.remove(
      "hidden"
    );
  }


  flowers = [];

  renderGarden();
  renderGallery();

  setStatus(
    "Sign in to enter the private garden. 🔒"
  );
}


// ======================================================
// LOAD FLOWERS / MEMORIES
// ======================================================

async function loadFlowers() {

  const user =
    await getCurrentUser();


  if (!user) {
    return;
  }


  setStatus(
    "Loading the private garden…"
  );


  const client =
    window.supabaseClient ||
    supabaseClient;


  const {
    data,
    error
  } = await client
    .from("flowers")
    .select("*")
    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "SUPABASE ERROR:",
      error
    );

    setStatus(
      "ERROR: " +
      error.message
    );

    showToast(
      "ERROR: " +
      error.message
    );

    return;
  }


  flowers =
    data || [];


  renderGarden();
  renderGallery();


  if (flowers.length) {

    setStatus(
      `${flowers.length} ${
        flowers.length === 1
          ? "memory"
          : "memories"
      } in our garden. 🌸`
    );

  } else {

    setStatus(
      "Our garden is waiting for its first drawing. 🌱"
    );

  }
}


// ======================================================
// CLEAR CANVAS
// ======================================================

function resetCanvas() {

  if (!canvas || !ctx) {
    return;
  }


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  ctx.fillStyle =
    "#fffdf8";


  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  erasing = false;


  if (eraserBtn) {
    eraserBtn.textContent =
      "Eraser";
  }


  ctx.lineCap =
    "round";

  ctx.lineJoin =
    "round";
}


// ======================================================
// CANVAS POSITION
// ======================================================

function canvasPoint(event) {

  const rect =
    canvas.getBoundingClientRect();


  return {

    x:
      (event.clientX - rect.left) *
      canvas.width /
      rect.width,

    y:
      (event.clientY - rect.top) *
      canvas.height /
      rect.height

  };
}


// ======================================================
// START DRAWING
// ======================================================

function startDrawing(event) {

  if (!canvas || !ctx) {
    return;
  }


  event.preventDefault();

  drawing = true;


  if (
    canvas.setPointerCapture
  ) {

    try {
      canvas.setPointerCapture(
        event.pointerId
      );
    } catch {}
  }


  const point =
    canvasPoint(event);


  ctx.beginPath();

  ctx.moveTo(
    point.x,
    point.y
  );
}


// ======================================================
// DRAW
// ======================================================

function draw(event) {

  if (!drawing) {
    return;
  }


  if (!ctx) {
    return;
  }


  event.preventDefault();


  const point =
    canvasPoint(event);


  ctx.lineWidth =
    Number(
      brushSize?.value || 7
    );


  ctx.strokeStyle =
    erasing
      ? "#fffdf8"
      : drawColor?.value || "#e99aa7";


  ctx.lineTo(
    point.x,
    point.y
  );


  ctx.stroke();
}


// ======================================================
// STOP DRAWING
// ======================================================

function stopDrawing() {

  drawing = false;

  if (ctx) {
    ctx.closePath();
  }
}


// ======================================================
// SAVE DRAWING
// ======================================================

async function plantFlower() {

  const user =
    await getCurrentUser();


  if (!user) {

    showToast(
      "Please sign in first. 🔒"
    );

    return;
  }


  const nameElement =
    document.getElementById(
      "flowerName"
    );


  const messageElement =
    document.getElementById(
      "flowerMessage"
    );


  const name =
    nameElement
      ? nameElement.value.trim()
      : "";


  const message =
    messageElement
      ? messageElement.value.trim()
      : "";


  if (!name && !message) {

    showToast(
      "Add a name or message first. 💌"
    );

    return;
  }


  if (!canvas) {

    showToast(
      "Drawing canvas not found."
    );

    return;
  }


  const drawingData =
    canvas.toDataURL(
      "image/png"
    );


  /*
    Prevent extremely large drawings
    from being inserted into Supabase.
  */

  if (
    drawingData.length >
    250000
  ) {

    showToast(
      "The drawing is too large. Please make it simpler. 🎨"
    );

    return;
  }


  const item = {

    type:
      "drawing",

    emoji:
      "🎨",

    name:
      name,

    message:
      message,

    drawing_data:
      drawingData,

    pos:
      flowerPosition()

  };


  const plantButton =
    document.getElementById(
      "plantBtn"
    );


  if (plantButton) {

    plantButton.disabled =
      true;

    plantButton.textContent =
      "Saving our memory… 🌱";
  }


  const client =
    window.supabaseClient ||
    supabaseClient;


  const {
    data,
    error
  } = await client
    .from("flowers")
    .insert([
      item
    ])
    .select()
    .single();


  if (plantButton) {

    plantButton.disabled =
      false;

    plantButton.textContent =
      "Add it to our garden 🌱";
  }


  if (error) {

    console.error(
      "Supabase insert error:",
      error
    );


    showToast(
      "Couldn't save it: " +
      error.message
    );


    return;
  }


  flowers.push(
    data
  );


  renderGarden();
  renderGallery();


  if (nameElement) {
    nameElement.value =
      "";
  }


  if (messageElement) {
    messageElement.value =
      "";
  }


  closeModal();


  setStatus(
    `${flowers.length} ${
      flowers.length === 1
        ? "memory"
        : "memories"
    } in our garden. 🌸`
  );


  showToast(
    "Your little memory has bloomed! 💗"
  );
}


// ======================================================
// OPEN DRAWING WINDOW
// ======================================================

function openModal() {

  resetCanvas();


  if (modal) {

    modal.classList.add(
      "show"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }
}


// ======================================================
// CLOSE DRAWING WINDOW
// ======================================================

function closeModal() {

  if (!modal) {
    return;
  }


  modal.classList.remove(
    "show"
  );


  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}


// ======================================================
// OPEN GALLERY
// ======================================================

function openGallery() {

  renderGallery();


  if (!gallery) {
    return;
  }


  gallery.classList.add(
    "show"
  );


  gallery.setAttribute(
    "aria-hidden",
    "false"
  );
}


// ======================================================
// CLOSE GALLERY
// ======================================================

function closeGallery() {

  if (!gallery) {
    return;
  }


  gallery.classList.remove(
    "show"
  );


  gallery.setAttribute(
    "aria-hidden",
    "true"
  );
}


// ======================================================
// LOGIN
// ======================================================

const loginForm =
  document.getElementById(
    "loginForm"
  );


if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      showAuthError("");


      const email =
        document
          .getElementById(
            "loginEmail"
          )
          ?.value
          .trim();


      const password =
        document
          .getElementById(
            "loginPassword"
          )
          ?.value || "";


      if (!email || !password) {

        showAuthError(
          "Please enter your email and password."
        );

        return;
      }


      const button =
        loginForm.querySelector(
          "button[type=submit]"
        );


      if (button) {

        button.disabled =
          true;

        button.textContent =
          "Signing in… 🌿";
      }


      const client =
        window.supabaseClient ||
        supabaseClient;


      const {
        error
      } =
        await client.auth
          .signInWithPassword({

            email:
              email,

            password:
              password

          });


      if (button) {

        button.disabled =
          false;

        button.textContent =
          "Enter our garden 🌿";
      }


      if (error) {

        console.error(
          "Login error:",
          error
        );


        showAuthError(
          "Email or password is incorrect."
        );

        return;
      }


      showToast(
        "Welcome back to our garden. 💕"
      );

    }
  );
}


// ======================================================
// LOG OUT
// ======================================================

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    async function () {

      const client =
        window.supabaseClient ||
        supabaseClient;


      await client.auth.signOut();

      showToast(
        "You have left the garden. 🌿"
      );

    }
  );
}


// ======================================================
// AUTH STATE CHANGES
// ======================================================

if (
  typeof supabaseClient !==
  "undefined"
) {

  supabaseClient.auth
    .onAuthStateChange(
      function (
        event,
        session
      ) {

        console.log(
          "Auth event:",
          event
        );


        setTimeout(
          function () {

            updateAuthUI(
              session
            );

          },
          0
        );

      }
    );

}


// ======================================================
// DRAW BUTTON
// ======================================================

const drawBtn =
  document.getElementById(
    "drawBtn"
  );


if (drawBtn) {

  drawBtn.addEventListener(
    "click",
    openModal
  );

}


// ======================================================
// CLOSE DRAWING MODAL
// ======================================================

const closeModalBtn =
  document.getElementById(
    "closeModal"
  );


if (closeModalBtn) {

  closeModalBtn.addEventListener(
    "click",
    closeModal
  );

}


// ======================================================
// GALLERY BUTTON
// ======================================================

const galleryBtn =
  document.getElementById(
    "galleryBtn"
  );


if (galleryBtn) {

  galleryBtn.addEventListener(
    "click",
    openGallery
  );

}


// ======================================================
// CLOSE GALLERY
// ======================================================

const closeGalleryBtn =
  document.getElementById(
    "closeGallery"
  );


if (closeGalleryBtn) {

  closeGalleryBtn.addEventListener(
    "click",
    closeGallery
  );

}


// ======================================================
// SAVE BUTTON
// ======================================================

const plantBtn =
  document.getElementById(
    "plantBtn"
  );


if (plantBtn) {

  plantBtn.addEventListener(
    "click",
    plantFlower
  );

}


// ======================================================
// CLEAR CANVAS
// ======================================================

const clearCanvasBtn =
  document.getElementById(
    "clearCanvasBtn"
  );


if (clearCanvasBtn) {

  clearCanvasBtn.addEventListener(
    "click",
    resetCanvas
  );

}


// ======================================================
// ERASER
// ======================================================

if (eraserBtn) {

  eraserBtn.addEventListener(
    "click",
    function () {

      erasing =
        !erasing;


      eraserBtn.textContent =
        erasing
          ? "Pen"
          : "Eraser";

    }
  );

}


// ======================================================
// CANVAS EVENTS
// ======================================================

if (canvas) {

  canvas.addEventListener(
    "pointerdown",
    startDrawing
  );


  canvas.addEventListener(
    "pointermove",
    draw
  );


  canvas.addEventListener(
    "pointerup",
    stopDrawing
  );


  canvas.addEventListener(
    "pointercancel",
    stopDrawing
  );


  canvas.addEventListener(
    "pointerleave",
    stopDrawing
  );

}


// ======================================================
// SURPRISE BUTTON
// ======================================================

const surpriseBtn =
  document.getElementById(
    "surpriseBtn"
  );


if (surpriseBtn) {

  surpriseBtn.addEventListener(
    "click",
    function () {

      const surprises = [

        "You deserve a garden full of good things. 🌷",

        "Something beautiful is growing here. 🌱",

        "Take a breath. Stay a while. 🍃",

        "Tiny steps still make a garden. 🌼",

        "Today is a good day to bloom. 🌻"

      ];


      const random =
        Math.floor(
          Math.random() *
          surprises.length
        );


      showToast(
        surprises[random]
      );

    }
  );

}


// ======================================================
// CLEAR BUTTON
// ======================================================

const clearBtn =
  document.getElementById(
    "clearBtn"
  );


if (clearBtn) {

  clearBtn.addEventListener(
    "click",
    function () {

      showToast(
        "Our shared memories are protected. 🌸"
      );

    }
  );

}


// ======================================================
// CLOSE MODALS BY CLICKING OUTSIDE
// ======================================================

[modal, gallery]
  .forEach(
    function (layer) {

      if (!layer) {
        return;
      }


      layer.addEventListener(
        "click",
        function (event) {

          if (
            event.target ===
            layer
          ) {

            layer.classList.remove(
              "show"
            );


            layer.setAttribute(
              "aria-hidden",
              "true"
            );

          }

        }
      );

    }
  );


// ======================================================
// ESC KEY
// ======================================================

document.addEventListener(
  "keydown",
  function (event) {

    if (
      event.key ===
      "Escape"
    ) {

      closeModal();
      closeGallery();

    }

  }
);


// ======================================================
// AUTO REFRESH
// ======================================================
//
// This gives us another layer of synchronization even
// if realtime isn't enabled yet.
//

setInterval(
  async function () {

    const user =
      await getCurrentUser();


    if (user) {

      await loadFlowers();

    }

  },
  30000
);


// ======================================================
// START APPLICATION
// ======================================================

resetCanvas();

renderGarden();

renderGallery();


getCurrentUser()
  .then(
    function (user) {

      updateAuthUI(
        user
          ? { user: user }
          : null
      );

    }
  )
  .catch(
    function (error) {

      console.error(
        "Startup error:",
        error
      );

    }
  );
