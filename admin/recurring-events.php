<?php

require_once __DIR__ . '/../api/lib/admin_auth.php';

qc_admin_require_page_token('Recurring Events Admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recurring Events Admin</title>
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="./admin.css">
  <script type="module" src="./recurring-events.js"></script>
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
    <div class="subtitle">RECURRING EVENTS ADMIN</div>
  </div>

  <main class="admin-wrap">
    <p class="admin-intro">Create and edit recurring events using schedule rules (days, frequency, and date window).</p>

    <form id="recurring-event-form" class="admin-form">
      <section class="panel">
        <h2>Auth + Actions</h2>
        <label>
          Admin token
          <input id="token" name="token" type="password" placeholder="Optional override">
        </label>
        <div class="admin-actions">
          <button id="load-options" type="button">Load DB options</button>
          <button id="load-events" type="button">Load recurring events</button>
          <button id="new-event" type="button">New recurring event</button>
          <button id="delete-event" type="button">Delete recurring event</button>
        </div>
      </section>

      <section class="panel">
        <h2>Event Details</h2>
        <input id="event-id" name="id" type="hidden">
        <label>
          Event name
          <input name="name" type="text" required>
        </label>
        <label>
          Description
          <textarea name="description" rows="4"></textarea>
        </label>
        <label>
          Event URL
          <input name="url" type="url" placeholder="https://...">
        </label>
        <label>
          Image URL
          <input name="image_url" type="url" placeholder="https://...">
        </label>
        <label>
          Category
          <select id="event-genre" name="genre">
            <option value="">Select a category</option>
          </select>
        </label>
        <label>
          Keywords (comma separated)
          <input name="keywords_text" type="text" placeholder="community, workshop, social">
        </label>
        <label>
          City
          <select id="city_id" name="city_id" required>
            <option value="">Load options first</option>
          </select>
        </label>
        <label>
          Place
          <select id="place_id" name="place_id" required>
            <option value="">Load options first</option>
          </select>
        </label>
        <label>
          Organization (optional)
          <select id="organization_id" name="organization_id">
            <option value="">No linked organization</option>
          </select>
        </label>
        <label>
          Organization role (optional)
          <input name="organization_role" type="text" placeholder="host, organizer">
        </label>
        <label>
          Event audience label (optional)
          <select id="event_audience_label_id" name="event_audience_label_id">
            <option value="">No label</option>
          </select>
        </label>
        <label>
          Pride (optional)
          <select id="pride_id" name="pride_id">
            <option value="">No linked pride</option>
          </select>
        </label>
      </section>

      <section class="panel">
        <h2>Schedule</h2>
        <label>
          Repeat frequency
          <select id="repeat_frequency" name="repeat_frequency" required>
            <option value="">Select frequency</option>
            <option value="Weekly">Weekly</option>
            <option value="Fortnightly">Fortnightly</option>
            <option value="Monthly">Monthly</option>
            <option value="P1W">P1W</option>
            <option value="P2W">P2W</option>
            <option value="P1M">P1M</option>
          </select>
        </label>
        <label>
          Timezone
          <input name="schedule_timezone" type="text" value="Europe/London" required>
        </label>
        <label>
          Start time
          <input name="start_time" type="time" required>
        </label>
        <label>
          End time (optional)
          <input name="end_time" type="time">
        </label>
        <label>
          Start date
          <input name="start_date" type="date" required>
        </label>
        <label>
          End date (optional)
          <input name="end_date" type="date">
        </label>
        <label>
          Repeat count (optional)
          <input name="repeat_count" type="number" min="1" step="1" placeholder="e.g. 12">
        </label>
        <fieldset>
          <legend>Days of week</legend>
          <div class="admin-actions">
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="MO">Mon</label>
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="TU">Tue</label>
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="WE">Wed</label>
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="TH">Thu</label>
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="FR">Fri</label>
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="SA">Sat</label>
            <label class="admin-checkbox"><input type="checkbox" name="by_day" value="SU">Sun</label>
          </div>
        </fieldset>
      </section>

      <section class="panel">
        <h2>Tags + Price (Optional)</h2>
        <label>
          Existing tags
          <select id="tag_ids" name="tag_ids" multiple size="8"></select>
        </label>
        <label>
          New tags (comma separated)
          <input name="new_tags_csv" type="text" placeholder="community, sober, workshop">
        </label>

        <label>
          Price
          <input name="price" type="number" step="0.01" min="0" placeholder="10.00">
        </label>
        <label>
          Price currency
          <input name="price_currency" type="text" maxlength="3" placeholder="GBP">
        </label>
        <label>
          Offer URL
          <input name="offer_url" type="url" placeholder="https://...">
        </label>
      </section>

      <button id="submit-btn" type="submit">Save recurring event</button>
      <pre id="status" class="status"></pre>
    </form>

    <section class="panel">
      <h2>Existing Recurring Events</h2>
      <div class="admin-actions">
        <label>
          Search
          <input id="events-filter-search" type="text" placeholder="Search name, id, keyword">
        </label>
        <label>
          Category
          <select id="events-filter-category">
            <option value="">All categories</option>
          </select>
        </label>
        <label>
          Frequency
          <select id="events-filter-frequency">
            <option value="">All frequencies</option>
          </select>
        </label>
        <button id="events-filter-reset" type="button">Clear filters</button>
      </div>
      <div id="events-listing" class="admin-listing"></div>
    </section>
  </main>

  <footer class="qc-footer">
    <a class="button-link" href="./index.php">ADMIN DASHBOARD</a>
    <a class="button-link" href="./add-event.php">ADD EVENT</a>
    <a class="button-link" href="./recurring-events.php">RECURRING EVENTS</a>
    <a class="button-link" href="./prides.php">PRIDES ADMIN</a>
    <a class="button-link" href="../newsletter/">NEWSLETTER</a>
    <a class="button-link" href="./index.php?logout=1">LOG OUT</a>
  </footer>
</body>
</html>
