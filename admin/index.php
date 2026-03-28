<?php

require_once __DIR__ . '/../api/lib/admin_auth.php';

qc_admin_require_page_token('Admin Dashboard');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard</title>
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="./admin.css">
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
    <div class="subtitle">ADMIN DASHBOARD</div>
  </div>

  <main class="admin-wrap">
    <section class="panel">
      <h2>Admin Actions</h2>
      <p class="admin-intro">All admin areas below are token-gated. Use the footer links for admin actions.</p>
    </section>
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
