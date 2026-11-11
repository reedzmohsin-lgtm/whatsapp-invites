# WhatsApp Event Invites

A static web app (no server, no accounts) for sending personal WhatsApp event invites.

- **index.html**: the organizer page. Create the event, add guests (pick from Contacts on Android Chrome, upload a CSV or vCard file, or type them in), preview the message and send.
- **invite.html**: the guest page linked from each message. It shows the event and has buttons for the .ics calendar file (Apple/Outlook), Google Calendar, the map, and Yes/Maybe/No RSVP. An RSVP opens WhatsApp with a reply to the host already written.

All event data is stored in the invite link itself, so nothing is kept on a server.

## Run locally

```bash
python3 -m http.server 8765 --directory whatsapp-invites
```

Then open http://localhost:8765.

## Put it online (needed for the guest page)

Guests can only open `invite.html` if the app is on a public address. Free options:

- **Netlify Drop**: drag the `whatsapp-invites` folder onto https://app.netlify.com/drop
- **GitHub Pages**: push the folder to a repository and turn on Pages

Enter the public address in **Public site address** on the organizer page.

## Importing contacts

- **Mac Contacts**: select the contacts, then choose File → Export → Export vCard, and upload the `.vcf` file.
- **iPhone**: share the contacts as a vCard, or export them from iCloud.com.
- **Google Contacts**: Export → Google CSV.
- **Any CSV** with a `Name` column and a `Phone`/`Mobile` column. See `sample-contacts.csv`.

Numbers that start with `0` get the default country code added.

## Limits of WhatsApp links

WhatsApp click-to-chat links only carry text, so you tap **Send** for each guest, and the calendar file and map go in as links.
To attach the real `.ics` file, use **Download .ics** and send it in the same chat. Fully automatic sending with file attachments,
a location pin and RSVP buttons needs the WhatsApp Business Cloud API.
