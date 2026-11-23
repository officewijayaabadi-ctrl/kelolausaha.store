# KelolaUsaha.store

Welcome to your shiny new Codespace running React! We've got everything fired up and running for you to explore React.

You've got a blank canvas to work on from a git perspective as well. There's a single initial commit with the what you're seeing right now - where you go from here is up to you!

Everything you do here is contained within this one codespace. There is no repository on GitHub yet. If and when you’re ready you can click "Publish Branch" and we’ll create your repository and push up your project. If you were just exploring then and have no further need for this code then you can simply delete your codespace and it's gone forever.

This project was bootstrapped for you with [Vite](https://vitejs.dev/).

## Available Scripts

In the project directory, you can run:

### `npm start`

We've already run this for you in the `Codespaces: server` terminal window below. If you need to stop the server for any reason you can just run `npm start` again to bring it back online.

Runs the app in the development mode.\
Open [http://localhost:3000/](http://localhost:3000/) in the built-in Simple Browser (`Cmd/Ctrl + Shift + P > Simple Browser: Show`) to view your running application.

The page will reload automatically when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Vite documentation](https://vitejs.dev/guide/).

To learn Vitest, a Vite-native testing framework, go to [Vitest documentation](https://vitest.dev/guide/)

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://sambitsahoo.com/blog/vite-code-splitting-that-works.html](https://sambitsahoo.com/blog/vite-code-splitting-that-works.html)

### Analyzing the Bundle Size

This section has moved here: [https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer)

### Making a Progressive Web App

This section has moved here: [https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf](https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf)

### Advanced Configuration

This section has moved here: [https://vitejs.dev/guide/build.html#advanced-base-options](https://vitejs.dev/guide/build.html#advanced-base-options)

### Deployment

This section has moved here: [https://vitejs.dev/guide/build.html](https://vitejs.dev/guide/build.html)

### Troubleshooting

This section has moved here: [https://vitejs.dev/guide/troubleshooting.html](https://vitejs.dev/guide/troubleshooting.html)

## Server, trial, and Midtrans

The public root URL is a marketing site with feature coverage, supported business examples, package prices, and calls to register. The authenticated console is for the KelolaUsaha.store platform owner; its public preview uses clearly labelled sample data. The prior organization structure is offered as the `dealer_motor` workspace type; tenant registration starts with that type selected.

The API uses PostgreSQL. Copy `.env.example` to `.env`, configure a database, a random `SESSION_SECRET`, the platform owner's email, SMTP, and Midtrans Sandbox credentials. Do not put SMTP or Midtrans secrets in frontend variables.

```sh
npm run db:migrate
npm run start:full
```

`npm run start:full` runs the Vite app on port 3000 and the API on port 4000; Vite proxies `/api` to the API. Apply the migration before starting. Production must serve the API and frontend on one origin (or configure an equivalent same-origin reverse proxy), use HTTPS, and set `MIDTRANS_ENV=production` only after configuring live Midtrans credentials.

New workspaces receive a one-calendar-month trial. Available activation packages are Rp299.000/1 month, Rp749.000/3 months, Rp1.399.000/6 months, Rp2.499.000/12 months, and Rp15.000.000/Lifetime. The backend fixes these amounts and creates Snap transactions; only a valid Midtrans notification signature and a successful settlement/capture activate a package. Configure the Midtrans payment notification URL to `/api/billing/midtrans-webhook`.

The platform owner email configured by `PLATFORM_OWNER_EMAIL` signs in through email OTP and sees workspace counts, statuses, owners, users, and paid totals. The person who registers a tenant workspace becomes its Owner and controls billing, bookkeeping, and access management. Owners can invite Super Admins through a one-time registration link verified by email OTP. Super Admins manage operations and can invite operational staff, but cannot invite or promote another Super Admin or access the Owner's bookkeeping or billing APIs. An in-app reminder is recorded in the last three days and a final expiration notice is recorded when the period ends. Billing/order/notification data are persisted in PostgreSQL.

Tenant Super Admins and Owners can customize the dashboard from **Pengaturan → Tampilan Dashboard**. Ten palettes are available (Merah Putih is the default); theme, custom colors, light/dark mode, sidebar density, card style, logo, and favicon are stored per company in `companies.theme_settings`. Older saved Biru Profesional defaults are migrated to Merah Putih. Logo and favicon uploads are restricted to recognized image types up to 2 MB. Set `UPLOAD_DIR` to persistent storage in production.

Restaurant/cafe workspaces have a digital menu ordering flow: customers can open a public menu link, enter their name and phone, select menu items, add special preparation notes, and choose payment timing. Table QR codes automatically fill in their table number. The cashier approves the order, kitchen marks it ready, and a waiter marks delivery. The cashier can confirm payment separately, allowing payment before or after service, and send the receipt to WhatsApp using `wa.me`. POS receipts can also be printed from the receipt view, and menu QR codes can be downloaded as SVGs. In the current demo, customer orders and staff queues are stored in browser local storage; this only synchronizes tabs on the same browser profile. Connect persistent menu/transaction endpoints before using this flow across customer and staff devices in production.

The help center stores conversations in PostgreSQL and delivers new messages in real time through Socket.IO. SMTP sends email notifications to the other participant; Gmail IMAP remains available to import replies sent from the support mailbox. Socket.IO is open source and has no license fee; email delivery is subject to the SMTP provider's limits and pricing.

Required deployment secrets/services: PostgreSQL `DATABASE_URL`, `SESSION_SECRET`, public `APP_ORIGIN`, SMTP host/password and account username, `PLATFORM_OWNER_EMAIL`, and Midtrans `MIDTRANS_SERVER_KEY`. Support email notifications and replies use `SUPPORT_EMAIL` (defaults to `kelolausaha.store@gmail.com`) as both the recipient and sender; configure SMTP credentials for that mailbox or an authorized send-as alias, and set IMAP credentials for the same inbox to sync replies. If `SMTP_USER` is not set, `IMAP_USER` and then `SMTP_FROM` are used as the SMTP username. Deployment verifies the SMTP and Gmail IMAP connections. Set `MIDTRANS_ENV=sandbox` for testing. The public `GET /api/system/status` endpoint reports whether OTP and Midtrans integrations are configured without exposing credentials. The payment flow cannot be exercised against live Midtrans until these are configured; use Sandbox for verification first.
