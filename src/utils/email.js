import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

const sendEmail = async ({ email, subject, message }) => {
    let transporter;

    if (process.env.EMAIL_HOST && process.env.EMAIL_USERNAME) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: Number(process.env.EMAIL_PORT) === 465,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    } else {
        const testAccount = await nodemailer.createTestAccount();
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
        to: email,
        subject: subject,
        text: message
    };

    const info = await transporter.sendMail(mailOptions);

    if (!process.env.EMAIL_HOST && process.env.NODE_ENV !== 'test') { // Supressed logic during unit testing
        logger.info(`Código enviado a ${email} | Vista previa: ${nodemailer.getTestMessageUrl(info)}`);
    }
};

export default sendEmail;
