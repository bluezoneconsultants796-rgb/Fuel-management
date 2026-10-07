import assert from 'node:assert/strict';
import { describe, it } from '../harness';
import { Envelope, loginAs, request } from '../http';

interface EntryData { id: string; status: string }
interface DriverData { id: string; isActive: boolean; vehicle?: unknown }

const ENTRY = {
  date: new Date().toISOString().slice(0, 10),
  time: '11:15',
  petrolPumpName: 'QA Status Pump',
  fuelType: 'Diesel',
  liters: 10,
  pricePerLiter: 280,
  totalAmount: 2800,
  receiptNumber: `QA-STATUS-${Date.now()}`
};

describe('Fuel entry review status (verify / reject)', () => {
  let entryId = '';

  it('driver creates an entry', async () => {
    const token = await loginAs('driver');
    const res = await request<Envelope<EntryData>>('/api/fuel', { method: 'POST', token, json: ENTRY });
    assert.equal(res.status, 201);
    entryId = res.json!.data!.id;
  });

  it('driver cannot change an entry status', async () => {
    const token = await loginAs('driver');
    const res = await request(`/api/fuel/${entryId}/status`, { method: 'PATCH', token, json: { status: 'rejected' } });
    assert.equal(res.status, 403);
  });

  it('accountant can reject an entry', async () => {
    const token = await loginAs('accountant');
    const res = await request<Envelope<EntryData>>(`/api/fuel/${entryId}/status`, {
      method: 'PATCH', token, json: { status: 'rejected' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.data?.status, 'rejected');
  });

  it('rejects an unknown status value', async () => {
    const token = await loginAs('accountant');
    const res = await request(`/api/fuel/${entryId}/status`, { method: 'PATCH', token, json: { status: 'banana' } });
    assert.equal(res.status, 400);
  });

  it('accountant can verify it again', async () => {
    const token = await loginAs('accountant');
    const res = await request<Envelope<EntryData>>(`/api/fuel/${entryId}/status`, {
      method: 'PATCH', token, json: { status: 'verified' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.data?.status, 'verified');
  });

  it('cleanup: admin deletes the entry', async () => {
    const token = await loginAs('admin');
    const res = await request(`/api/fuel/${entryId}`, { method: 'DELETE', token });
    assert.equal(res.status, 200);
  });
});

describe('Driver deactivation is persisted', () => {
  it('PUT isActive=false actually stores it on the driver, and true restores it', async () => {
    const token = await loginAs('admin');
    const created = await request<Envelope<DriverData>>('/api/drivers', {
      method: 'POST', token,
      json: { name: 'QA Toggle Driver', phone: '+92-300-1234567', employeeId: `QA-TGL-${Date.now() % 100000}` }
    });
    assert.equal(created.status, 201);
    const id = created.json!.data!.id;

    const off = await request<Envelope<DriverData>>(`/api/drivers/${id}`, { method: 'PUT', token, json: { isActive: false } });
    assert.equal(off.status, 200);
    assert.equal(off.json?.data?.isActive, false);

    const refetched = await request<Envelope<DriverData>>(`/api/drivers/${id}`, { token });
    assert.equal(refetched.json?.data?.isActive, false);

    const on = await request<Envelope<DriverData>>(`/api/drivers/${id}`, { method: 'PUT', token, json: { isActive: true } });
    assert.equal(on.json?.data?.isActive, true);

    await request(`/api/drivers/${id}`, { method: 'DELETE', token });
  });
});
