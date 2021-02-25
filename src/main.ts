import { NestFactory } from '@nestjs/core';
import { v2 as webdav } from 'webdav-server';
import { AppModule } from './app.module';
import * as fs from 'fs';
import { Next } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const HTTPNoAuthentication = (function () {
    function HTTPNoAuthentication(userManager, realm) {
      if (realm === void 0) {
        realm = 'realm';
      }

      this.userManager = userManager;
      this.realm = realm;
    }

    HTTPNoAuthentication.prototype.askForAuthentication = function () {
      return {
        'WWW-Authenticate': `Basic realm="${this.realm}"`,
      };
    };

    HTTPNoAuthentication.prototype.getUser = function (ctx, callback) {
      this.userManager.getDefaultUser(function (defaultUser) {
        callback(null, defaultUser);
      });
    };

    return HTTPNoAuthentication;
  })();

  const MS_WEBDAV = RegExp('^Microsoft');

  function setHeaders(arg, next) {
    if (arg.request.method === 'OPTIONS') {
      arg.response.setHeader(
        'Access-Control-Allow-Methods',
        'PROPPATCH,PROPFIND,OPTIONS,DELETE,UNLOCK,COPY,LOCK,MKCOL,MOVE,HEAD,POST,PUT,GET',
      );

      arg.response.setHeader(
        'allow',
        'PROPPATCH,PROPFIND,OPTIONS,DELETE,UNLOCK,COPY,LOCK,MKCOL,MOVE,HEAD,POST,PUT,GET',
      );
      arg.response.setHeader('Access-Control-Allow-Headers', '*');
      arg.response.setHeader('Access-Control-Allow-Origin', '*');
    }

    arg.response.setHeader('MS-Author-Via', 'DAV');
    const userAgent = arg.request.headers['user-agent'];
    if (userAgent && MS_WEBDAV.test(userAgent)) {
      arg.response.removeHeader('dav');
    }
    next();
  }

  const userManager = new webdav.SimpleUserManager();

  const server = new webdav.WebDAVServer({
    port: 2000,
    httpAuthentication: new HTTPNoAuthentication(userManager, 'Default realm'),
  });

  server.beforeRequest((arg, next) => {
    setHeaders(arg, next);
    next();
  });

  const dir = __dirname + '/public';

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  server.setFileSystem(
    '/folder',
    new webdav.PhysicalFileSystem(__dirname + '/public'),
    (success) => {
      server.start(() => console.log('READY', success));
    },
  );

  await app.listen(1901);
}
bootstrap();
