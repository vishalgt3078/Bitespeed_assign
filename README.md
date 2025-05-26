# Bitespeed Backend Task: Identity Reconciliation

This project implements a web service for Bitespeed to identify and keep track of a customer's identity across multiple purchases using different contact information. The service exposes an `/identify` endpoint that processes contact details and returns a consolidated contact view.

## Hosted Endpoint

The `/identify` endpoint is live and hosted on Render. It can be accessed at:

**`https://bitespeed-assign-zteo.onrender.com/api/identify`**

## Tech Stack

*   **Backend:** Node.js, Express.js
*   **Language:** TypeScript
*   **ORM:** Prisma
*   **Database:** PostgreSQL (hosted on Render)
*   **Deployment:** Render.com


## Setup and Running Locally

To set up and run this project on your local machine, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/vishalgt3078/Bitespeed_assign.git
    cd Bitespeed_assign
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables:**
    Create a `.env` file in the root directory of the project. Add your PostgreSQL database connection string:
    ```env
    # .env
    DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public"
    ```
    Replace `USER`, `PASSWORD`, `HOST`, `PORT`, and `DATABASE_NAME` with your local PostgreSQL details.
    *(For quick local testing without PostgreSQL, you could temporarily modify `prisma/schema.prisma` to use `provider = "sqlite"` and set `DATABASE_URL="file:./prisma/dev.db"` in your `.env` file, then run migrations.)*

4.  **Run Database Migrations:**
    This will create the `Contact` table in your local database based on the Prisma schema.
    ```bash
    npx prisma migrate dev --name initial-schema
    ```
    *(You can use a different migration name if you prefer)*

5.  **Generate Prisma Client:**
    This generates the type-safe Prisma Client based on your schema.
    ```bash
    npx prisma generate
    ```

6.  **Run in Development Mode:**
    This command starts the server using `ts-node-dev` for live reloading.
    ```bash
    npm run dev
    ```
    The server will typically start on `http://localhost:3000`. The `/identify` endpoint will be accessible at `http://localhost:3000/api/identify`.

7.  **Build and Run for Production-like Local Test (Optional):**
    To test the compiled version locally:
    ```bash
    npm run build  # Compiles TypeScript to JavaScript in ./dist and resolves path aliases
    npm run start  # Runs the compiled code from ./dist
    ```

## API Endpoint: `/identify`

This endpoint is used to identify a customer and consolidate their contact information.

*   **Method:** `POST`
*   **URL (Hosted):** `https://bitespeed-assign-zteo.onrender.com/api/identify`
*   **URL (Local):** `http://localhost:3000/api/identify`
*   **Request Body:** `JSON`
    ```json
    {
      "email"?: "string",
      "phoneNumber"?: "string" // Can also be a number, will be converted to string
    }
    ```
    *(At least one of `email` or `phoneNumber` must be provided)*

*   **Example Request (using `curl` for the hosted endpoint):**
    ```bash
    curl -X POST https://YOUR_RENDER_SERVICE_NAME.onrender.com/api/identify \
    -H "Content-Type: application/json" \
    -d '{
      "email": "marty@ будущем.com",
      "phoneNumber": "88005553535"
    }'
    ```

*   **Success Response (HTTP 200 OK):**
    The response contains the consolidated contact information.
    ```json
    {
        "contact": {
            "primaryContactId": 1, // ID of the primary contact
            "emails": ["primary-email@example.com", "secondary-email@example.com"], // All unique emails, primary's first
            "phoneNumbers": ["123456789", "987654321"], // All unique phone numbers, primary's first
            "secondaryContactIds": [2, 3] // IDs of all secondary contacts linked to the primary
        }
    }
    ```

## Key Logic Implemented

*   **New Contact Creation:** If no existing contacts match the request, a new primary contact is created.
*   **Secondary Contact Creation:** If a request shares an email or phone number with an existing contact group but introduces new contact information (a new email or phone number not already in the group), a new secondary contact is created and linked to the group's primary contact.
*   **Linking Existing Contacts:**
    *   If a request links two previously separate primary contacts, the older contact (by `createdAt`) remains primary. The newer contact becomes secondary, and all contacts previously linked to it are re-linked to the new overall primary contact.
    *   No new contact row is created for the request data itself if all its information can be accounted for by the existing (now linked) contacts in the group.
*   **Response Consolidation:** The API response always provides a single view of the customer, with one `primaryContactId`, a list of all associated `emails` and `phoneNumbers` (with the primary's information listed first), and a list of all `secondaryContactIds`.

## Deployment Details (Render.com)

*   The application is configured to deploy automatically from the `main` branch of this GitHub repository.
*   **Build Command on Render:** `npm install && npx prisma migrate deploy && npx prisma generate && npm run build`
    *   This command installs dependencies, runs database migrations, generates the Prisma client, and then builds the TypeScript project (compiling TS to JS and resolving path aliases).
*   **Start Command on Render:** `npm run start` (which executes `node dist/server.js`)

---
# Demo Screenshots
![image](https://github.com/user-attachments/assets/e9da7bf2-d989-473d-a10b-0454b29a4901)
![image](https://github.com/user-attachments/assets/79f13803-d14f-4d60-b8f5-d1d5e9a1f1cf)

*This project was created for the Bitespeed Backend Developer Task.*
