<?php

require_once __DIR__ . '/../api/lib/admin_auth.php';

qc_admin_require_page_token('Prides Admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Prides</title>
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="./admin.css">
  <script type="module" src="./prides.js"></script>
</head>
<body>
  <div class="header">
    <nav>
      <a href="../">EVENTS</a> |
      <a href="../prides/">PRIDES</a> |
      <a href="../weekdays/">WEEKDAYS</a> |
      <a href="../archive/">PAST EVENTS</a>
    </nav>
    <div class="title">QUEER CITY</div>
    <span class="circle"></span>
    <div class="subtitle">ADMIN PRIDES</div>
  </div>

  <main class="admin-wrap">
    <p class="admin-intro">Create, edit, publish, and seed Pride records for the live Prides page.</p>

    <section class="panel">
      <h2>Auth + Actions</h2>
      <label>
        Admin token
        <input id="token" name="token" type="password" placeholder="Optional override">
      </label>
      <div class="admin-actions">
        <button id="load-prides" type="button">Load prides</button>
        <button id="seed-prides" type="button">Seed defaults</button>
        <button id="new-pride" type="button">New pride</button>
      </div>
    </section>

    <form id="pride-form" class="admin-form">
      <section class="panel">
        <h2>Pride Details</h2>
        <input id="pride-id" name="id" type="hidden">
        <label>
          Name
          <input id="pride-name" name="name" type="text" required>
        </label>
        <label>
          Website URL
          <input id="pride-website-url" name="website_url" type="url" placeholder="https://...">
        </label>
        <label>
          Location
          <input id="pride-location" name="location" type="text" placeholder="Didsbury">
        </label>
        <label>
          Borough
          <select id="pride-borough" name="borough" required>
            <option value="">Load prides first</option>
          </select>
        </label>
        <label>
          Start date
          <input id="pride-start-date" name="start_date" type="date">
        </label>
        <label>
          End date
          <input id="pride-end-date" name="end_date" type="date">
        </label>
        <label class="admin-checkbox">
          <input id="pride-published" name="published" type="checkbox">
          Published
        </label>
        <label>
          Slug (optional)
          <input id="pride-slug" name="slug" type="text">
        </label>
        <label>
          Notes (optional)
          <textarea id="pride-notes" name="notes" rows="4"></textarea>
        </label>
        <div class="admin-actions">
          <button id="save-pride" type="submit">Save pride</button>
          <button id="delete-pride" type="button">Delete pride</button>
        </div>
      </section>
    </form>

    <section class="panel">
      <h2>Existing Prides</h2>
      <div id="prides-listing" class="admin-listing"></div>
    </section>

    <pre id="status" class="status"></pre>
  </main>

  <footer class="qc-footer">
    <a class="button-link" href="./index.php">ADMIN DASHBOARD</a>
    <a class="button-link" href="./add-event.php">ADD EVENT</a>
    <a class="button-link" href="./prides.php">PRIDES ADMIN</a>
    <a class="button-link" href="../newsletter/">NEWSLETTER</a>
    <a class="button-link" href="./index.php?logout=1">LOG OUT</a>
  </footer>
</body>
</html>
