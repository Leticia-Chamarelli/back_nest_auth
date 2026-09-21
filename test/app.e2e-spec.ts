import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Server } from 'http';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

interface ProfileResponse {
  user: { id: number; username: string };
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let accessToken: string;
  let refreshToken: string;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should login with valid credentials', async () => {
    const response = await request(server)
      .post('/auth/login')
      .send({
        username: 'testuser2',
        password: '123456',
      })
      .expect(201);

    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('refresh_token');

    const body = response.body as TokenPair;
    accessToken = body.access_token;
    refreshToken = body.refresh_token;
  });

  it('should not login with invalid credentials', async () => {
    const response = await request(server).post('/auth/login').send({
      username: 'wronguser',
      password: 'wrongpassword',
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  it('should access protected route with valid token', async () => {
    const response = await request(server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as ProfileResponse;
    expect(body.user).toHaveProperty('username', 'testuser2');
  });

  it('should fail to access protected route without token', async () => {
    const response = await request(server).get('/auth/profile').expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should refresh token with valid refresh_token', async () => {
    const refreshResponse = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: refreshToken })
      .expect(201);

    expect(refreshResponse.body).toHaveProperty('access_token');
    expect(refreshResponse.body).toHaveProperty('refresh_token');

    const body = refreshResponse.body as TokenPair;
    accessToken = body.access_token;
    refreshToken = body.refresh_token;
  });

  it('should logout and invalidate the refresh token', async () => {
    await request(server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const refreshAttempt = await request(server)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);

    expect(refreshAttempt.body).toHaveProperty('message');
  });

  it('should fail to logout without being authenticated', async () => {
    const response = await request(server).post('/auth/logout').expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('should not allow reuse of an invalidated refresh token', async () => {
    const loginResponse = await request(server)
      .post('/auth/login')
      .send({ username: 'testuser2', password: '123456' })
      .expect(201);

    const loginBody = loginResponse.body as TokenPair;
    const refreshToken = loginBody.refresh_token;

    await request(server)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(201);

    const refreshResponse = await request(server)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);

    expect(refreshResponse.body).toHaveProperty('message');
  });

  it('should fail to access protected route with expired access token', async () => {
    const payload = { username: 'testuser2', sub: 2 };

    const shortLivedToken = jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1s',
    });

    await new Promise((res) => setTimeout(res, 2000));

    const response = await request(server)
      .get('/auth/profile')
      .set('Authorization', `Bearer ${shortLivedToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  it('should fail to access protected route with an invalid access token', async () => {
    const fakeToken = 'Bearer faketoken.invalid.signature';

    const response = await request(server)
      .get('/auth/profile')
      .set('Authorization', fakeToken);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  it('should fail to refresh with invalid or expired refresh token', async () => {
    const invalidToken = 'invalid.token.string';

    const invalidResponse = await request(server)
      .post('/auth/refresh')
      .send({ refresh_token: invalidToken });

    expect(invalidResponse.status).toBe(401);
    expect(invalidResponse.body).toHaveProperty('message');

    const payload = { username: 'testuser2', sub: 2 };
    const expiredRefreshToken = app.get(JwtService).sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '1s',
    });

    await new Promise((res) => setTimeout(res, 2000));

    const expiredResponse = await request(server)
      .post('/auth/refresh')
      .send({ refresh_token: expiredRefreshToken });

    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body).toHaveProperty('message');
  });
});

describe('Users authorization (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let ownerToken: string;
  let ownerId: number;
  let otherToken: string;
  let otherUserId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const ownerUsername = `owner_${suffix}`;
    const otherUsername = `other_${suffix}`;

    interface RegisterResponse {
      user: { id: number; username: string };
    }

    const ownerRegister = await request(server)
      .post('/auth/register')
      .send({ username: ownerUsername, password: 'password123' })
      .expect(201);
    ownerId = (ownerRegister.body as RegisterResponse).user.id;

    const otherRegister = await request(server)
      .post('/auth/register')
      .send({ username: otherUsername, password: 'password123' })
      .expect(201);
    otherUserId = (otherRegister.body as RegisterResponse).user.id;

    const ownerLogin = await request(server)
      .post('/auth/login')
      .send({ username: ownerUsername, password: 'password123' })
      .expect(201);
    ownerToken = (ownerLogin.body as TokenPair).access_token;

    const otherLogin = await request(server)
      .post('/auth/login')
      .send({ username: otherUsername, password: 'password123' })
      .expect(201);
    otherToken = (otherLogin.body as TokenPair).access_token;
  });

  afterAll(async () => {
    await request(server)
      .delete(`/users/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    await request(server)
      .delete(`/users/${otherUserId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    await app.close();
  });

  it('should allow a user to update their own account', async () => {
    await request(server)
      .patch(`/users/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: `owner_updated_${Date.now()}` })
      .expect(200);
  });

  it('should forbid a user from updating another account', async () => {
    const response = await request(server)
      .patch(`/users/${otherUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ username: 'hijacked' })
      .expect(403);

    expect(response.body).toHaveProperty('message');
  });

  it('should forbid a user from deleting another account', async () => {
    const response = await request(server)
      .delete(`/users/${otherUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    expect(response.body).toHaveProperty('message');
  });
});
