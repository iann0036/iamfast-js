# iamfast

<img src="https://raw.githubusercontent.com/iann0036/iamfast/readme/assets/cli.png" width="450" alt="CLI Screenshot">

## About

This is an issues-only repo for **iamfast**, a toolset which generates AWS IAM policies from application code.

## Installation

```
npm i -g iamfast
```

You can also install iamfast as a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=iann0036.iamfast).

## Usage

Execute `iamfast` with the first argument being the file or directory to be scanned.

```
iamfast yourfile.js
```

iamfast will support the following programming languages:

* JavaScript (v2/v3 SDK)
* Python 3 (Boto3 SDK)
* Go (v1/v2 SDK)
* Java (v2 SDK)
* PHP (v3 SDK)
* C/C++ (v1 SDK)
* Rust (v1 SDK)
* .NET/C# (v3/v4 SDK)
* Ruby (v1 SDK)

#### Optional Flags

`--format <type>`: Sets the format of the output, currently supporting `json` (default), `yaml`, `hcl` and `sam`

## Example

```
> cat tests/js/test1.js
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'us-east-1'});

// Create the DynamoDB service object
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

var params = {
  TableName: 'CUSTOMER_LIST',
  Item: {
    'CUSTOMER_ID' : {N: '001'},
    'CUSTOMER_NAME' : {S: 'Richard Roe'}
  }
};

// Call DynamoDB to add the item to the table
ddb.putItem(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Success", data);
  }
});
```

```
> iamfast tests/js/test1.js
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "dynamodb:PutItem",
            "Resource": [
                "arn:aws:dynamodb:us-east-1:123456789012:table/CUSTOMER_LIST"
            ]
        }
    ]
}
```
