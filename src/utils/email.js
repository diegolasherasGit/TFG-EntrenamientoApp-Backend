import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    let transporter;

    if (process.env.EMAIL_HOST && process.env.EMAIL_USERNAME) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT == 465,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    } else {
        let testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }

    const mailOptions = {
        from: 'BulderLand Team <hello@bulderland.com>',
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    const info = await transporter.sendMail(mailOptions);

    if (!process.env.EMAIL_HOST && process.env.NODE_ENV !== 'test') { // Supressed logic during unit testing
        console.log('\n====================================');
        console.log(`📩  Código enviado a ${options.email}`);
        console.log(`👀  Vista previa Correo: ${nodemailer.getTestMessageUrl(info)}`);
        console.log('====================================\n');
    }
};

export default sendEmail;
