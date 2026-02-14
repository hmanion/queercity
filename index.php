<!DOCTYPE html>
<html lang="en">

<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="api/output.php">
  <link rel="preconnect" href="api/directory.php">
  <meta charset="utf-8" />
  <script type="module" src="./js/events-main.module.js"></script>
</head>

<body>

  <?php require __DIR__ . '/includes/header.php'; qc_render_header('', 'events'); ?>

  <div id="eventlist"></div>

  <?php require __DIR__ . '/includes/footer.php'; qc_render_footer(''); ?>

</body>

</html>
