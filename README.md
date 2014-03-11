# aws-setup

A Node Module and Command Line Tool for initializing AWS setups via scripts or JSON.

It allows you to define your entire AWS server setup, simple or complex, within JSON or JavaScript files.
You can use ___variables___ and ___formatters___ if your definitions need to be dynamic!



## Install

```
npm install aws-setup
```

To use aws-setup in your command line, add `aws-setup/bin` to your `PATH` environment variable.


## Examples

### Static setup

Let's assume you have a config file `MyServer.json` looking like that:

```javascript
{
    "Main": {
        "steps": ["c-sg", "u-sg", "c-i"],

        "securityGroup": {
            "GroupName": "main-sg-1",
            "Description": "Main SG 1"
        },

        "securityGroupIngress": {
            "GroupName": "main-sg-1",
            "IpPermissions": [{
                "IpProtocol": "tcp",
                "FromPort": 80,
                "ToPort": 80,
                "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
            }]
        },

        "instances": {
            "ImageId": "ami-123d5c4a",
            "MinCount": 1,
            "MaxCount": 1,
            "KeyName": "myKeyPair",
            "SecurityGroups": ["main-sg-1"],
            "InstanceType": "t1.micro",
            "UserData": "VGVzdEluc3RhbmNl"
        }
    }
}
```

You can setup the security group, grant global access via port 80 and launch an instance inside it with

```
aws-setup -i MyServer.json
```

If you want to split this action into two commands, which is quite useful when working on AWS (e.g. to wait for an instance to start/terminate/...), do

```
aws-setup -i MyServer.json -g Main -s c-sg,u-sg
aws-setup -i MyServer.json -g Main -s c-i
```

The first command creates the security group (`c-sg`) and updates its permissions (`u-sg`), while the second command creates the new instance (`c-i`). Those abbreviated commands are called ___steps___ (`-s`).

The naming scheme of the steps are defined in the default [stepmap](https://github.com/riga/aws-setup/blob/master/stepmap.json) and can be customized. See [below](#stepmap) for more information (recommended).


Both commands have the `-g Main` argument meaning that the definitions of group (`-g`) `Main` is loaded, which clearly is the name of the top-level object in our `MyServer.json` file.


### Dynamic setup

The static example above has some drawbacks: e.g. if you want to use an other AMI you have to update the entry manually in your `MyServer.json` file. In this case, you can use ___variables___ (`${}`).

In this example, we set the `"ImageId"` entry to

```
"ImageId": "${amiId}"
```

and call aws-setup with

```
aws-setup -i MyServer.json -p amiId=ami-NEWAMIID
```

You can even set default values via

```
"ImageId": "${amiId|ami-DEFAULTAMIID}"
```

Another drawback would be the use of static `UserData` which must be base64 encoded (see [ec2 docs](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#runInstances-property)). This is a greate usecase for ___formatters___ (`$()`).

We can set the `"UserData"` entry to

```
"UserData": "$(base64:MyData)"
```

`base64` is defined in [formatters.js](https://github.com/riga/aws-setup/blob/master/lib/formatters.js) but you can also use your own ones. See [below](#formatters) for more information.

You can even ___combine___ variables and formatters, e.g.

```
"UserData": "$(base64:${userData})"
```

plus

```
aws-setup -i MyServer.json -p userData=MyData
```


## Description

This is what you get when you type `aws-setup --help` (as of version 0.1.5):

```
$> aws-setup --help

  Usage: aws-setup [options]

  Options:

    -h, --help                       output usage information
    -c, --credentials-file [FILE]    the location of your AWS credentials, default: ~/.aws/credentials.json
    -d, --setups-dir [DIR]           the location of your setups/ folder, default: ./setups
    -i, --setup-file [FILE]          the setup file, relative to <setups-dir> (no file extension -> json > js), default: setup.(json|js)
    -m, --step-map [FILE]            an additional step mapping json file, relative to <setups-dir>, default: stepmap.json
    -f, --formatters [FILE]          an additional file containing formatters, relative to <setups-dir>, default: formatters.js
    -g, --group [NAME[,...]]         the group to setup, accepts a list, default: all groups
    -s, --steps [NAME[,...]]         the steps to execute, accepts a list (,) or a list of lists (:), default: all steps
    -p, --payload [KEY=VALUE,[...]]  payload that is parsed into your definitions
    -l, --log-level [LEVEL]          the log level, {all,debug,info,warning,error,fatal}, default: info
    -e, --execute                    execute without prompting
    -a, --abort                      abort when a request failed
    -V, --version                    output the version number
```

### <a name="stepmap"></a>Step Mapping

TODO

### <a name="formatters"></a>Formatters

TODO


## Development

- Source hosted at [GitHub](https://github.com/riga/aws-setup)
- npm module hosted at [npmjs.org](https://www.npmjs.org/package/aws-setup)
- Report issues, questions, feature requests on
[GitHub Issues](https://github.com/riga/aws-setup/issues)


## Authors

[Marcel R.](https://github.com/riga)
