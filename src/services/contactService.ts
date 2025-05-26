import { PrismaClient, Contact, LinkPrecedence } from '@prisma/client';

const prisma = new PrismaClient();

interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

interface IdentifyResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

export const identifyContact = async (
  data: IdentifyRequest
): Promise<IdentifyResponse> => {
  const { email, phoneNumber } = data;

  // 1. Find existing contacts by email or phone number
  let matchingContacts: Contact[] = [];
  if (email || phoneNumber) {
    matchingContacts = await prisma.contact.findMany({
      where: {
        OR: [
          email ? { email: email } : {},
          phoneNumber ? { phoneNumber: phoneNumber } : {},
        ].filter(condition => Object.keys(condition).length > 0), // Ensure OR is not empty
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
    });
  }


  let primaryContact: Contact | null = null;
  let secondaryContacts: Contact[] = [];

  // If no existing contacts, create a new primary contact
  if (matchingContacts.length === 0) {
    if (!email && !phoneNumber) {
        // This case should ideally be validated before calling this service
        // or handled as an early return with an error if the requirements
        // strictly mean "will always have either an email or phoneNumber".
        // For now, let's assume input validation is done upstream or we create an empty primary
        // if allowed (though the spec says one must be present).
        // If the requirement is strict and this happens, it's an issue.
        // To be safe and align with "create a new Contact row", let's create one
        // but this might need clarification based on strict interpretation.
    }
    primaryContact = await prisma.contact.create({
      data: {
        email: email || null,
        phoneNumber: phoneNumber || null,
        linkPrecedence: LinkPrecedence.PRIMARY,
      },
    });
  } else {
    // Identify all unique primary contacts from the matches
    const primaryIds = new Set<number>();
    matchingContacts.forEach(contact => {
      if (contact.linkPrecedence === LinkPrecedence.PRIMARY) {
        primaryIds.add(contact.id);
      } else if (contact.linkedId) {
        primaryIds.add(contact.linkedId);
      }
    });
    
    const distinctPrimaryContacts = await prisma.contact.findMany({
        where: { id: { in: Array.from(primaryIds) } },
        orderBy: { createdAt: 'asc'},
    });

    primaryContact = distinctPrimaryContacts[0]; // The oldest one

    // If there are multiple primary contacts that need to be consolidated
    if (distinctPrimaryContacts.length > 1) {
        const primaryToKeep = distinctPrimaryContacts[0];
        const primariesToDemote = distinctPrimaryContacts.slice(1);

        for (const p of primariesToDemote) {
            // Demote primary to secondary
            await prisma.contact.update({
                where: { id: p.id },
                data: {
                    linkedId: primaryToKeep.id,
                    linkPrecedence: LinkPrecedence.SECONDARY,
                    updatedAt: new Date() // Manually update updatedAt
                }
            });
            // Update all contacts linked to the demoted primary
            await prisma.contact.updateMany({
                where: { linkedId: p.id },
                data: { 
                    linkedId: primaryToKeep.id,
                    updatedAt: new Date() // Manually update updatedAt
                }
            });
        }
        // After demotion, primaryContact should still be the one we decided to keep
        primaryContact = primaryToKeep;
    }


    // Check if the current request introduces new information
    // (new email or phone not already associated with the primaryContact's group)
    // First, get all contacts linked to the determined primaryContact
    const allLinkedContacts = await prisma.contact.findMany({
        where: {
            OR: [
                { id: primaryContact.id },
                { linkedId: primaryContact.id }
            ]
        }
    });

    const existingEmails = new Set(allLinkedContacts.map(c => c.email).filter(Boolean));
    const existingPhoneNumbers = new Set(allLinkedContacts.map(c => c.phoneNumber).filter(Boolean));

    let newInfoProvided = false;
    if (email && !existingEmails.has(email)) {
      newInfoProvided = true;
    }
    if (phoneNumber && !existingPhoneNumbers.has(phoneNumber)) {
      newInfoProvided = true;
    }

    // If new info is provided OR if the request details don't exactly match any single existing contact row
    // (e.g. email from one contact, phone from another, but not together in one row)
    // create a new secondary contact.
    // More precise: Create new secondary if the (email, phoneNumber) pair from request doesn't exist.
    const requestDataAlreadyExistsAsARow = allLinkedContacts.some(
      c => (email ? c.email === email : !c.email) && // handles null email in DB
           (phoneNumber ? c.phoneNumber === phoneNumber : !c.phoneNumber) // handles null phone in DB
    );
    
    // Only create if there's *some* info in the request AND
    // (it's genuinely new info OR it's not an exact duplicate row already)
    // AND the primaryContact is determined.
    if (primaryContact && (email || phoneNumber) && (!requestDataAlreadyExistsAsARow || newInfoProvided)) {
        // Check again to ensure we don't create a duplicate entry if email/phone matches primary
        // This means if incoming (e,p) is same as primary's (e,p), no new secondary is made.
        // If incoming (e,p) is same as an existing secondary's (e,p), no new secondary.
        // Only create if (e,p) from request is a *new combination* for this identity group.

        let shouldCreateNewSecondary = true;
        if (primaryContact.email === email && primaryContact.phoneNumber === phoneNumber) {
            shouldCreateNewSecondary = false;
        } else {
             const existingSecondaryMatch = allLinkedContacts.find(
                c => c.linkPrecedence === LinkPrecedence.SECONDARY &&
                     c.email === email && 
                     c.phoneNumber === phoneNumber
             );
             if (existingSecondaryMatch) {
                shouldCreateNewSecondary = false;
             }
        }
        
        // The condition `!requestDataAlreadyExistsAsARow` covers the above checks more generally.
        // If the exact pair (email, phoneNumber) of the request is not in `allLinkedContacts`, create one.
        // Exception: if email AND phoneNumber from request are NULL (which means empty request object effectively).
        if (!requestDataAlreadyExistsAsARow && (email || phoneNumber)) {
             await prisma.contact.create({
                data: {
                  email: email || null,
                  phoneNumber: phoneNumber || null,
                  linkedId: primaryContact.id,
                  linkPrecedence: LinkPrecedence.SECONDARY,
                },
              });
        }
    }
  }

  // After all modifications, fetch the final state of the consolidated contact
  if (!primaryContact) {
    // This should ideally not be reached if logic above is correct and input is valid.
    // However, as a fallback or if the input was truly empty (no email, no phone)
    // and we decided not to create a primary earlier:
    throw new Error("Could not determine or create a primary contact.");
  }

  const finalPrimaryContact = await prisma.contact.findUniqueOrThrow({
    where: { id: primaryContact.id }
  });

  const allContactsInGroup = await prisma.contact.findMany({
    where: {
      OR: [
        { id: finalPrimaryContact.id },
        { linkedId: finalPrimaryContact.id },
      ],
    },
    orderBy: { // Ensure primary is first for email/phone ordering, then by creation
        createdAt: 'asc',
    }
  });

  const emails = new Set<string>();
  const phoneNumbers = new Set<string>();
  const secondaryContactIds: number[] = [];

  // Add primary's info first, if available
  if (finalPrimaryContact.email) emails.add(finalPrimaryContact.email);
  if (finalPrimaryContact.phoneNumber) phoneNumbers.add(finalPrimaryContact.phoneNumber);

  allContactsInGroup.forEach(contact => {
    if (contact.id !== finalPrimaryContact.id) { // It's a secondary
      secondaryContactIds.push(contact.id);
    }
    if (contact.email) emails.add(contact.email);
    if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
  });
  
  // Ensure primary's details are first in the arrays if they exist
  const sortedEmails = [
    ...(finalPrimaryContact.email ? [finalPrimaryContact.email] : []),
    ...Array.from(emails).filter(e => e !== finalPrimaryContact.email)
  ];
  const sortedPhoneNumbers = [
    ...(finalPrimaryContact.phoneNumber ? [finalPrimaryContact.phoneNumber] : []),
    ...Array.from(phoneNumbers).filter(p => p !== finalPrimaryContact.phoneNumber)
  ];


  return {
    contact: {
      primaryContactId: finalPrimaryContact.id,
      emails: sortedEmails,
      phoneNumbers: sortedPhoneNumbers,
      secondaryContactIds: secondaryContactIds.sort((a,b) => a - b), // Sort for consistency
    },
  };
};