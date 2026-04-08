# Prompt Examples

Use prompts like these to help users reach value fast.

## Inspect a Form

```text
Load my Google Form with formId <FORM_ID> and summarize:
- its title
- how many items it has
- the question types in order
- any obvious problems in the structure
```

## Create a New Form

```text
Create a new Google Form called "Client Intake Form" with a short description for new clients, then add a required short-answer question called "Project owner name".
```

## Add a Question

```text
Open the form with formId <FORM_ID> and add a required short-answer question titled "Project owner name" at the end.
```

## Improve a Form

```text
Inspect my Google Form with formId <FORM_ID>, identify unclear or low-quality questions, and then rewrite the weakest 3 questions to be more precise without changing the form's intent.
```

## Insert a Section

```text
In the form <FORM_ID>, add a new section called "Technical Requirements" before the current item at index 6, then add a paragraph question called "Describe your current stack".
```

## Convert a Question Type

```text
Load form <FORM_ID>, find the question titled "Preferred contact method", and convert it into a dropdown with the options Email, WhatsApp, Phone call, and Video call.
```

## Reorder Items

```text
Move the item titled "Budget range" so it appears immediately after the question "Project timeline".
```

## Attach an Image to a Question

```text
Add this public image URL to the question titled "Which visual direction do you prefer?" in form <FORM_ID>, and set alt text that explains the image's purpose.
```

## Publish a Form

```text
Publish my Google Form <FORM_ID> and confirm whether it is accepting responses.
```

## Review Responses

```text
List the latest 20 responses for form <FORM_ID> and summarize the most common answers and patterns.
```

## Safer Agent Pattern

The best agent behavior is:

1. read first with `get_form` or `list_items`
2. confirm target item by `itemId` or index
3. mutate once
4. read again if doing more edits

This reduces accidental edits to the wrong item.
