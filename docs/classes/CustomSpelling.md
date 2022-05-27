[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / CustomSpelling

# Class: CustomSpelling

The **Custom Spelling** feature gives you the ability to specify how words are spelled or formatted in the transcript text. For example, Custom Spelling could be used to change the spelling of all instances of the word `"Ariana"` to `"Arianna"`. It could also be used to change the formatting of `"CS 50"` to `"CS50"`.

The `custom_spelling` parameter along with `from` and `to` values are used to define how the spelling of a word or words should be customized. The `from` value is how the word would normally be predicted in the transcript. The `to` value is how you would like the word to be spelled or formatted. Here is a JSON object showing how the `custom_spelling` parameter could be used:
```
    "custom_spelling": [
      {
        "from": ["cs 50", "cs fifty"],
        "to": "CS50"
      },
      {
        "from": ["Ariana"],
        "to": "Arianna"
      },
      {
        "from": ["Carla"],
        "to": "Karla"
      },
      {
        "from": ["Sarah"],
        "to": "Sara"
      }
    ]
```

Note:

The value in the `to` key is case-sensitive but the value in the `from` key is not.

You can reference the code examples on the right to see how the `custom_spelling` parameter is used in a POST request.

## Table of contents

### Constructors

- [constructor](CustomSpelling.md#constructor)

### Properties

- [from](CustomSpelling.md#from)
- [to](CustomSpelling.md#to)

## Constructors

### constructor

• **new CustomSpelling**()

## Properties

### from

• `Optional` **from**: `string`[]

A list of non-case-sensitive strings to convert from.

#### Defined in

[types/custom-spelling.ts:36](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/custom-spelling.ts#L36)

___

### to

• `Optional` **to**: `string`

The case-sensitive string to convert to.

#### Defined in

[types/custom-spelling.ts:40](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/custom-spelling.ts#L40)
