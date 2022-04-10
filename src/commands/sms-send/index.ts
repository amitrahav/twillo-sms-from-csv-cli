import {Command, Flags} from '@oclif/core'
import * as csv from 'fast-csv'
import * as twilio from 'twilio'
import * as fs from 'node:fs'

export default class TwilloSMSFromCsv extends Command {
  static description = 'Send SMS from CSV file'

  static args = [
    {
      name: 'csv-file',               // name of arg to show in help and reference with args[name]
      required: true,            // make the arg required with `required: true`
      description: 'csv path of phone-numes', // help description
      hidden: false,               // hide this arg from help
    },
    {
      name: 'twillo-sid',               // name of arg to show in help and reference with args[name]
      required: true,            // make the arg required with `required: true`
      description: 'Twillo accountSid', // help description
      hidden: false,               // hide this arg from help
    },
    {
      name: 'twillo-auth',               // name of arg to show in help and reference with args[name]
      required: true,            // make the arg required with `required: true`
      description: 'Twillo authToken', // help description
      hidden: false,               // hide this arg from help
    },
    {
      name: 'twillo-from',               // name of arg to show in help and reference with args[name]
      required: true,            // make the arg required with `required: true`
      description: 'Valid Twillo phone number to send from', // help description
      hidden: false,               // hide this arg from help
    },
    {
      name: 'message',               // name of arg to show in help and reference with args[name]
      required: true,            // make the arg required with `required: true`
      description: 'Sms message body to send', // help description
      hidden: false,               // hide this arg from help
    },
  ]

  static flags = {
    col: Flags.integer({
      char: 'c',                    // shorter flag version
      description: 'phones-col-idx', // help description for flag
      hidden: false,                // hide from help
      multiple: false,              // allow setting this flag multiple times
      default: 0,             // default value if flag not passed (can be a function that returns a string or undefined)
      required: false,              // make flag required (this is not common and you should probably use an argument instead)
      exclusive: ['colName'],    // this flag cannot be specified alongside this other flag
    }),
    colName: Flags.string({
      char: 'n',                    // shorter flag version
      description: 'phones-col-name', // help description for flag
      hidden: false,                // hide from help
      multiple: false,              // allow setting this flag multiple times
      required: false,              // make flag required (this is not common and you should probably use an argument instead)
      exclusive: ['col'],    // this flag cannot be specified alongside this other flag
    }),
  }

  static examples = [
    `$ oex sms-send /Users/me/users.csv XXXX XXXX  -c0
    SENT! (./src/commands/hello/index.ts)`,
  ]

  getHeaderName(firstRow: Record<string, string>, {colName, col}: {colName: string | undefined, col: number}): string {
    // eslint-disable-next-line no-negated-condition
    const header = colName !== undefined ? colName : Object.keys(firstRow)[col]
    return header
  }

  prefixPhoneNums(csvData:Record<string, string>[], header: string): Record<string, string>[] {
    return csvData.filter(data => data[header] !== '').map(data => {
      data[header] = `+972${data[header].replace('-', '').replace(' ', '')}`
      return data
    })
  }

  async csvRead(file:string): Promise<Record<string, string> []> {
    const dataRows: Record<string, string>[] = []
    return new Promise((resolve, reject) => {
      fs.createReadStream(file)
      .pipe(csv.parse({headers: true}))
      .on('error', error => {
        console.log(`Failed ${error.message}`)
        return reject(error.message)
      })
      .on('data', row => dataRows.push(row))
      .on('end', (rowCount: number) => {
        console.log(`Parsed ${rowCount} rows`)
        return resolve(dataRows)
      })
    })
  }

  async sendSMS(sid: string, auth: string, data: Record<string, string>[], header: string, from: string, body: string): Promise<void> {
    const client = twilio(sid, auth)

    for await (const rec of data) {
      // eslint-disable-next-line no-new
      new Promise(resolve => {
        client.messages
        .create({
          body,
          to: rec[header], // Text this number
          from: from, // From a valid Twilio number
        })
        .then(message => {
          console.log(`SENT to ${rec[header]} - messageID: ${message.sid}`)
          resolve(message.sid)
        })
        .catch(error => {
          console.error(error)
          resolve(error)
        })
      })
    }
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(TwilloSMSFromCsv)
    const dataRows = await this.csvRead(args['csv-file'])
    const header = this.getHeaderName(dataRows[0], flags)
    const prefixPhones = this.prefixPhoneNums(dataRows, header)
    await this.sendSMS(args['twillo-sid'], args['twillo-auth'], prefixPhones, header, args['twillo-from'], args.message)
  }
}
