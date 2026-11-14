export async function mockFirebase(page, testEmail, testName = 'Test User', mockUid = 'mock-uid-123', mockIdToken = 'mock-id-token') {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const generateMockIdToken = (uid, email) => {
    const header = { alg: "RS256", kid: "mock-key", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      name: testName,
      iss: "https://securetoken.google.com/mock-project-id",
      aud: "mock-project-id",
      auth_time: now,
      user_id: uid,
      sub: uid,
      iat: now,
      exp: now + 3600,
      email: email,
      email_verified: false,
      firebase: {
        identities: { email: [email] },
        sign_in_provider: "password"
      }
    };
    return b64(header) + "." + b64(payload) + ".mock-signature";
  };

  const idToken = mockIdToken && mockIdToken !== 'mock-id-token' ? mockIdToken : generateMockIdToken(mockUid, testEmail);

  // Mock token exchange
  await page.route('**/v1/token*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'mock-refresh-token',
        id_token: idToken,
        user_id: mockUid,
        project_id: 'mock-project-id'
      })
    });
  });

  // Mock Authentication APIs
  await page.route('**/v1/accounts*', async route => {
    const url = route.request().url();
    if (url.includes('signUp')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#SignupNewUserResponse',
          idToken: idToken,
          email: testEmail,
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          localId: mockUid
        })
      });
    } else if (url.includes('signInWithPassword')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#VerifyPasswordResponse',
          localId: mockUid,
          email: testEmail,
          displayName: testName,
          idToken: idToken,
          registered: true,
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600'
        })
      });
    } else if (url.includes('lookup')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [{
            localId: mockUid,
            email: testEmail,
            emailVerified: false,
            displayName: testName,
            validSince: '123456789'
          }]
        })
      });
    } else if (url.includes('update')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          localId: mockUid,
          email: testEmail,
          displayName: testName,
          providerUserInfo: []
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock Firestore GET requests (documents lookup/read) for the mock user profile
  await page.route('**/databases/*/documents/users/mock-uid-123', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: "projects/mock-project-id/databases/mock-db/documents/users/mock-uid-123",
        fields: {
          v: { integerValue: "3" },
          nid: { integerValue: "100" },
          stats: {
            mapValue: {
              fields: {
                activeClients: { integerValue: "0" },
                prospectiveClients: { integerValue: "0" },
                stoppedClients: { integerValue: "0" },
                totalClients: { integerValue: "0" },
                totalPrograms: { integerValue: "0" },
                totalLicensedDevices: { integerValue: "0" },
                averageScore: { integerValue: "100" },
                totalOpenIssues: { integerValue: "0" }
              }
            }
          },
          updatedAt: { stringValue: new Date().toISOString() }
        }
      })
    });
  });

  // Mock clients collection list (empty list initially)
  await page.route('**/databases/*/documents/users/mock-uid-123/clients', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        documents: []
      })
    });
  });

  // Mock any other subcollection query / lists
  await page.route('**/databases/*/documents/users/mock-uid-123/clients/**', async route => {
    const url = route.request().url();
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: []
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock write commits
  await page.route('**/databases/*/documents:commit*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        writeResults: [{}],
        commitTime: new Date().toISOString()
      })
    });
  });

  // Catch-all mock for other firestore.googleapis.com requests to make them succeed instantly
  await page.route('https://firestore.googleapis.com/**', async route => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [] })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ commitTime: new Date().toISOString() })
      });
    }
  });
}
